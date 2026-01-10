/* eslint-disable @typescript-eslint/no-explicit-any */
import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import axios from 'axios';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import { prisma } from 'database';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import IORedis from 'ioredis';
import path from 'path';
import { ZodError } from 'zod';
import {
  BODY_LIMIT_GLOBAL,
  BODY_LIMIT_SMALL,
  BODY_LIMIT_STANDARD,
  CONNECTION_TIMEOUT_MS,
  CONTAINER_CPU_NANOCPUS,
  CONTAINER_MEMORY_LIMIT_BYTES,
  METRICS_UPDATE_INTERVAL_MS,
} from './config/constants';
import { ServiceCreateSchema, ServiceUpdateSchema } from './schemas/service.schema';
import { decrypt, encrypt } from './utils/crypto';
import {
  createRefreshToken,
  revokeAllUserRefreshTokens,
  verifyAndRotateRefreshToken,
} from './utils/refreshToken';
import { getRepoUrlMatchCondition } from './utils/repoUrl';
import { withStatusLock } from './utils/statusLock';

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Separate connection for subscriptions
const subConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

const deploymentQueue = new Queue('deployments', {
  connection: redisConnection,
});

// Helper function to parse and get allowed origins from environment
function getAllowedOrigins(): string[] {
  const originsEnv =
    process.env.ALLOWED_ORIGINS || process.env.APP_BASE_URL || 'http://localhost:3000';
  return originsEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// Helper function to validate if an origin is allowed
// Note: This returns false for undefined origins, but the CORS plugin
// at the framework level allows no-origin requests (same-origin, curl, etc.)
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

// Helper function to get a safe origin for CORS headers
// Returns the validated request origin if allowed, otherwise the first allowed origin
function getSafeOrigin(requestOrigin: string | undefined): string {
  const allowedOrigins = getAllowedOrigins();

  // Ensure we always have at least one allowed origin
  if (allowedOrigins.length === 0) {
    throw new Error('CORS misconfiguration: No allowed origins configured');
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowedOrigins[0];
}

// Helper function to get the default port for service type
function getDefaultPortForServiceType(serviceType: string): number {
  const portMap: Record<string, number> = {
    STATIC: 80,
    POSTGRES: 5444,
    REDIS: 6379,
    MYSQL: 3306,
    DOCKER: 3000,
  };
  return portMap[serviceType] || 3000;
}

// Helper to determine service status
function determineServiceStatus(service: any, containers: any[]): string {
  // If the service itself is marked as DEPLOYING in the database, respect that first
  if (service.status === 'DEPLOYING') {
    return 'DEPLOYING';
  }

  const serviceContainers = containers.filter(
    (c) =>
      c.Labels['helvetia.serviceId'] === service.id ||
      (service.type === 'COMPOSE' && c.Labels['com.docker.compose.project'] === service.name),
  );
  const latestDeployment = service.deployments[0];

  // If there's an active deployment in progress, it's DEPLOYING
  if (latestDeployment && ['QUEUED', 'BUILDING'].includes(latestDeployment.status)) {
    return 'DEPLOYING';
  }

  if (serviceContainers.length > 0) {
    if (serviceContainers.some((c) => c.State === 'running')) {
      return 'RUNNING';
    }
    if (serviceContainers.some((c) => c.State === 'restarting')) {
      return 'CRASHING';
    }
    if (serviceContainers.every((c) => ['exited', 'dead', 'created'].includes(c.State))) {
      return 'STOPPED';
    }
    return serviceContainers[0].State.toUpperCase();
  }

  if (latestDeployment) {
    if (latestDeployment.status === 'FAILED') {
      return 'FAILED';
    }
    if (latestDeployment.status === 'SUCCESS') {
      return 'STOPPED';
    }
  }

  return 'IDLE';
}

// Helper to create and queue deployment
async function createAndQueueDeployment(service: any, commitHash: string) {
  const deployment = await prisma.deployment.create({
    data: {
      serviceId: service.id,
      status: 'QUEUED',
      commitHash: commitHash,
    },
  });

  // Inject token if available
  let repoUrlData = service.repoUrl;
  const dbUser = await prisma.user.findUnique({ where: { id: service.userId } });
  if (dbUser?.githubAccessToken && repoUrlData && repoUrlData.includes('github.com')) {
    const decryptedToken = decrypt(dbUser.githubAccessToken);
    repoUrlData = repoUrlData.replace('https://', `https://${decryptedToken}@`);
  }

  await deploymentQueue.add('build', {
    deploymentId: deployment.id,
    serviceId: service.id,
    repoUrl: repoUrlData,
    branch: service.branch,
    buildCommand: service.buildCommand,
    startCommand: service.startCommand,
    serviceName: service.name,
    port: service.port,
    envVars: service.envVars,
    customDomain: (service as any).customDomain,
    type: (service as any).type,
    staticOutputDir: (service as any).staticOutputDir,
  });

  return deployment;
}

// Helper to delete a service and its resources
async function deleteService(id: string, userId?: string) {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return;

  // Verify ownership if userId is provided
  if (userId && service.userId !== userId) {
    throw new Error('Unauthorized service deletion attempt');
  }

  // 1. Stop and remove containers if they exist
  const Docker = (await import('dockerode')).default;
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });
  const serviceContainers = containers.filter(
    (c) =>
      c.Labels['helvetia.serviceId'] === id ||
      (service.type === 'COMPOSE' && c.Labels['com.docker.compose.project'] === service.name),
  );

  for (const containerInfo of serviceContainers) {
    const container = docker.getContainer(containerInfo.Id);
    console.log(`Stopping and removing container ${containerInfo.Id} for service ${id}`);
    await container.stop().catch(() => {});
    await container.remove().catch(() => {});
  }

  // Clean up associated volumes for database services
  const serviceType = (service as any).type;
  if (serviceType && ['POSTGRES', 'REDIS', 'MYSQL'].includes(serviceType)) {
    const volumeName = `helvetia-data-${service.name}`;
    try {
      const volume = docker.getVolume(volumeName);
      await volume.remove();
      console.log(`Removed volume ${volumeName} for service ${service.name}`);
    } catch (err) {
      if ((err as any).statusCode !== 404) {
        console.error(`Failed to remove volume ${volumeName}:`, err);
      }
    }
  } else if (serviceType === 'COMPOSE') {
    try {
      const { Volumes } = await docker.listVolumes();
      const projectVolumes = Volumes.filter(
        (v) => v.Labels && v.Labels['com.docker.compose.project'] === service.name,
      );

      for (const volumeInfo of projectVolumes) {
        const volume = docker.getVolume(volumeInfo.Name);
        await volume.remove();
        console.log(`Removed volume ${volumeInfo.Name} for compose project ${service.name}`);
      }
    } catch (err) {
      console.error(`Failed to list/remove volumes for compose project ${service.name}:`, err);
    }
  }

  // 1.5 Remove associated images
  const deployments = await prisma.deployment.findMany({
    where: { serviceId: id },
    select: { imageTag: true },
  });

  const imageTags = new Set(
    deployments.map((d) => d.imageTag).filter((tag): tag is string => !!tag),
  );

  for (const tag of imageTags) {
    try {
      const image = docker.getImage(tag);
      await image.remove({ force: true });
      console.log(`Removed image ${tag}`);
    } catch (err) {
      // Don't log error if image doesn't exist
      if ((err as any).statusCode !== 404) {
        console.error(`Failed to remove image ${tag}:`, err);
      }
    }
  }

  // 2. Delete deployments and services from DB
  await prisma.deployment.deleteMany({ where: { serviceId: id } });
  await prisma.service.delete({ where: { id } });
}

// Helper to get metrics for a service
async function getServiceMetrics(
  id: string,
  dockerInstance?: any,
  containerList?: any[],
  serviceInfo?: { name: string; type: string; status?: string },
) {
  const Docker = (await import('dockerode')).default;
  const docker = dockerInstance || new Docker();

  const containers = containerList || (await docker.listContainers({ all: true }));

  // Use either the explicit serviceInfo or try to find it from labels if missing
  // (though callers should provide it for accuracy with COMPOSE)
  const allServiceContainers = containers.filter(
    (c: any) =>
      c.Labels['helvetia.serviceId'] === id ||
      (serviceInfo?.type === 'COMPOSE' &&
        c.Labels['com.docker.compose.project'] === serviceInfo?.name),
  );

  // Determine aggregate status
  let status: string;
  if (serviceInfo?.status === 'DEPLOYING') {
    status = 'DEPLOYING';
  } else if (allServiceContainers.length > 0) {
    if (allServiceContainers.some((c: any) => c.State === 'running')) {
      status = 'RUNNING';
    } else if (allServiceContainers.some((c: any) => ['restarting', 'created'].includes(c.State))) {
      status = 'DEPLOYING';
    } else if (
      allServiceContainers.some((c: any) => c.State === 'exited' && c.Status.includes('Exited (0)'))
    ) {
      // If it's a one-off task that finished successfully
      status = 'STOPPED';
    } else {
      status = 'FAILED';
    }
  } else {
    status = 'NOT_RUNNING';
  }

  const runningContainers = allServiceContainers.filter((c: any) => c.State === 'running');

  if (runningContainers.length === 0) {
    return { cpu: 0, memory: 0, memoryLimit: 0, status };
  }

  let totalCpu = 0;
  let totalMemory = 0;
  let totalMemoryLimit = 0;

  // Process all running containers and sum their metrics
  await Promise.all(
    runningContainers.map(async (containerInfo: any) => {
      try {
        const container = docker.getContainer(containerInfo.Id);
        const stats = await container.stats({ stream: false });

        if (stats.cpu_stats && stats.precpu_stats) {
          const cpuDelta =
            stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
          const systemDelta =
            stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
          const onlineCpus = stats.cpu_stats.online_cpus || 1;

          if (systemDelta > 0 && cpuDelta > 0) {
            totalCpu += (cpuDelta / systemDelta) * onlineCpus * 100.0;
          }
        }

        if (stats.memory_stats) {
          const usage = stats.memory_stats.usage - (stats.memory_stats.stats.cache || 0);
          totalMemory += usage / 1024 / 1024;
          totalMemoryLimit += stats.memory_stats.limit / 1024 / 1024;
        }
      } catch {
        // Ignore stats errors for individual containers
      }
    }),
  );

  return {
    cpu: parseFloat(totalCpu.toFixed(2)),
    memory: parseFloat(totalMemory.toFixed(2)),
    memoryLimit: parseFloat(totalMemoryLimit.toFixed(2)),
    status,
  };
}

// Helper to validate JWT token from request
async function validateToken(request: any): Promise<boolean> {
  try {
    // Try to verify the JWT token
    await request.jwtVerify();
    return true;
  } catch (error) {
    // Token is invalid or expired
    console.log('Token validation failed:', (error as Error).message);
    return false;
  }
}

// GitHub webhook signature verification
function verifyGitHubSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);
    if (signatureBuffer.length !== digestBuffer.length) {
      return false;
    }
    // Use timingSafeEqual to prevent timing attacks
    return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
  } catch (error) {
    console.error('Error verifying GitHub signature:', error);
    return false;
  }
}

/**
 * Body Size Limits Configuration
 *
 * Request body size limits protect against DoS attacks by preventing
 * attackers from sending extremely large payloads that could exhaust
 * server resources (memory, CPU, network bandwidth).
 *
 * Limits:
 * - Global: 10MB - Maximum size for any request body
 * - Standard: 1MB - For endpoints handling moderate data (webhooks, logs)
 * - Small: 100KB - For simple requests (auth, service configs)
 *
 * Routes with specific limits:
 * - POST/PATCH /services: 100KB (service configuration)
 * - POST /auth/github: 100KB (authentication)
 * - POST /webhooks/github: 1MB (GitHub webhook payloads)
 *
 * Error Response (413 Payload Too Large):
 * {
 *   "statusCode": 413,
 *   "error": "Payload Too Large",
 *   "message": "Request body exceeds the maximum allowed size of XMB"
 * }
 *
 * Configuration via environment variables:
 * - BODY_LIMIT_GLOBAL_MB: Maximum size for any request body (default: 10MB)
 * - BODY_LIMIT_STANDARD_MB: For endpoints handling moderate data (default: 1MB)
 * - BODY_LIMIT_SMALL_KB: For simple requests (default: 100KB)
 */

// Body size limits are imported from config/constants.ts

export const fastify = Fastify({
  logger: process.env.NODE_ENV !== 'test' && !process.env.VITEST,
  bodyLimit: BODY_LIMIT_GLOBAL,
});

// Export CORS helper functions and body limits for testing
export {
  BODY_LIMIT_GLOBAL,
  BODY_LIMIT_SMALL,
  BODY_LIMIT_STANDARD,
  getAllowedOrigins,
  getSafeOrigin,
  isOriginAllowed,
};

fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (like curl, Postman, or same-origin requests)
    if (!origin) {
      cb(null, true);
      return;
    }

    // Check if origin is in the allowed list
    if (isOriginAllowed(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});

fastify.register(fastifyCookie);
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'supersecret',
  cookie: {
    cookieName: 'token',
    signed: false,
  },
  sign: {
    expiresIn: '15m', // Short-lived access token (15 minutes)
  },
});

// Global rate limiting
fastify.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  redis: redisConnection,
  nameSpace: 'helvetia-rate-limit:',
  skipOnError: true, // Don't block requests if Redis is down
  allowList: ['/health'], // Exclude health endpoint
  keyGenerator: (request) => {
    // Global limiter is intentionally IP-based because authentication runs later
    return request.ip;
  },
  errorResponseBuilder: (_request, context) => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${Math.ceil(context.ttl / 1000)} seconds`,
    };
  },
  addHeadersOnExceeding: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
});

// Stricter rate limiting for authentication endpoints
const authRateLimitConfig = {
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  timeWindow: process.env.AUTH_RATE_LIMIT_WINDOW || '1 minute',
  redis: redisConnection,
  nameSpace: 'helvetia-auth-rate-limit:',
  skipOnError: true,
  addHeadersOnExceeding: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
};

// Stricter rate limiting for SSE/streaming endpoints
const wsRateLimitConfig = {
  max: parseInt(process.env.WS_RATE_LIMIT_MAX || '10', 10),
  timeWindow: process.env.WS_RATE_LIMIT_WINDOW || '1 minute',
  redis: redisConnection,
  nameSpace: 'helvetia-ws-rate-limit:',
  skipOnError: true,
  addHeadersOnExceeding: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
};

// Error handler for body size limit exceeded
fastify.setErrorHandler((error: Error & { code?: string }, request, reply) => {
  // Handle FST_ERR_CTP_BODY_TOO_LARGE error (Fastify body too large error)
  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    const limit = error.message.match(/(\d+)/)?.[0] || 'unknown';
    return reply.status(413).send({
      statusCode: 413,
      error: 'Payload Too Large',
      message: `Request body exceeds the maximum allowed size of ${Math.floor(parseInt(limit) / 1024 / 1024)}MB`,
    });
  }

  // Re-throw the error for other error handlers
  throw error;
});

// Auth hook
fastify.addHook('onRequest', async (request, reply) => {
  const publicRoutes = [
    '/health',
    '/webhooks/github',
    '/auth/github',
    '/auth/refresh',
    '/auth/logout',
  ];
  if (publicRoutes.includes(request.routeOptions?.url || '')) {
    return;
  }
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

fastify.get('/health', async () => {
  return { status: 'ok' };
});

fastify.post(
  '/auth/github',
  {
    config: { rateLimit: authRateLimitConfig },
    bodyLimit: BODY_LIMIT_SMALL, // 100KB limit for auth requests
  },
  async (request, reply) => {
    const { code } = request.body as any;

    if (!code) {
      return reply.status(400).send({ error: 'Code is required' });
    }

    try {
      // 1. Exchange code for access token
      const tokenRes = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        },
        {
          headers: { Accept: 'application/json' },
        },
      );

      const { access_token, error } = tokenRes.data;

      if (error) {
        return reply.status(401).send({ error });
      }

      // 2. Fetch user info
      const userRes = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${access_token}` },
      });

      const githubUser = userRes.data;

      // 3. Upsert user in DB
      const encryptedToken = encrypt(access_token);
      const user = await prisma.user.upsert({
        where: { githubId: githubUser.id.toString() },
        update: {
          username: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          githubAccessToken: encryptedToken,
        },
        create: {
          githubId: githubUser.id.toString(),
          username: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          githubAccessToken: encryptedToken,
        },
      });

      // 4. Generate access token (short-lived)
      const token = fastify.jwt.sign({ id: user.id, username: user.username });

      // 5. Generate refresh token (long-lived)
      const refreshToken = await createRefreshToken(user.id);

      // 6. Set cookies and return user
      // Access token cookie (15 minutes)
      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 15, // 15 minutes
      });

      // Refresh token cookie (30 days)
      reply.setCookie('refreshToken', refreshToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return { user, token };
    } catch (err: any) {
      console.error('Auth error:', err.response?.data || err.message);
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  },
);

fastify.post('/auth/refresh', async (request, reply) => {
  const refreshToken = request.cookies.refreshToken;

  if (!refreshToken) {
    return reply.status(401).send({ error: 'Refresh token not provided' });
  }

  try {
    const result = await verifyAndRotateRefreshToken(refreshToken, fastify, redisConnection);

    if (!result) {
      // Clear invalid cookies
      reply.clearCookie('token', { path: '/' });
      reply.clearCookie('refreshToken', { path: '/' });
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    // Set new access token cookie (15 minutes)
    reply.setCookie('token', result.accessToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15, // 15 minutes
    });

    // Set new refresh token cookie (30 days)
    reply.setCookie('refreshToken', result.refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return {
      accessToken: result.accessToken,
      message: 'Token refreshed successfully',
    };
  } catch (err: any) {
    console.error('Refresh token error:', err.message);
    return reply.status(500).send({ error: 'Failed to refresh token' });
  }
});

fastify.post('/auth/logout', async (request, reply) => {
  const user = (request as any).user;

  // Revoke all refresh tokens for the user
  if (user?.id) {
    try {
      await revokeAllUserRefreshTokens(user.id, redisConnection);
    } catch (err) {
      console.error('Error revoking refresh tokens:', err);
    }
  }

  // Clear cookies
  reply.clearCookie('token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  reply.clearCookie('refreshToken', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return { message: 'Logged out successfully' };
});

fastify.get('/auth/me', async (request) => {
  const user = (request as any).user;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      githubId: true,
      githubAccessToken: true, // we check if it exists
    },
  });

  return {
    ...dbUser,
    isGithubConnected: !!dbUser?.githubAccessToken,
    githubAccessToken: undefined, // Don't send the token itself
  };
});

fastify.delete('/auth/github/disconnect', async (request) => {
  const user = (request as any).user;
  await prisma.user.update({
    where: { id: user.id },
    data: { githubAccessToken: null },
  });
  return { success: true };
});

// Service Routes
fastify.get('/services', async (request) => {
  // Add authentication middleware in a real app
  const user = (request as any).user;
  const services = await prisma.service.findMany({
    where: { userId: user.id, deletedAt: null },
    include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  // Enrich services with actual Docker container status
  const Docker = (await import('dockerode')).default;
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });

  return services.map((service) => ({
    ...service,
    status: determineServiceStatus(service, containers),
  }));
});

fastify.get('/services/:id', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (!service) return reply.status(404).send({ error: 'Service not found' });

  // Enrich service with actual Docker container status
  const Docker = (await import('dockerode')).default;
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });

  return {
    ...service,
    status: determineServiceStatus(service, containers),
  };
});

fastify.patch(
  '/services/:id',
  {
    bodyLimit: BODY_LIMIT_SMALL, // 100KB limit for service updates
  },
  async (request, reply) => {
    const { id } = request.params as any;

    // Validate and parse request body
    let validatedData;
    try {
      validatedData = ServiceUpdateSchema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw error;
    }

    const {
      name,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port,
      envVars,
      customDomain,
      type,
      staticOutputDir,
    } = validatedData;

    const user = (request as any).user;
    const service = await prisma.service.updateMany({
      where: { id, userId: user.id },
      data: {
        name,
        repoUrl,
        branch,
        buildCommand,
        startCommand,
        port: port ?? (type ? getDefaultPortForServiceType(type) : undefined),
        envVars,
        customDomain,
        type: type,
        staticOutputDir,
      },
    });

    if (service.count === 0)
      return reply.status(404).send({ error: 'Service not found or unauthorized' });

    return prisma.service.findUnique({ where: { id } });
  },
);

fastify.post(
  '/services',
  {
    bodyLimit: BODY_LIMIT_SMALL, // 100KB limit for service creation
  },
  async (request, reply) => {
    // Validate and parse request body
    let validatedData;
    try {
      validatedData = ServiceCreateSchema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw error;
    }

    const {
      name,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port,
      customDomain,
      type,
      staticOutputDir,
      envVars,
    } = validatedData;

    const finalType = type || 'DOCKER';
    const user = (request as any).user;
    const userId = user.id;

    // Check ownership if exists
    const existing = await prisma.service.findUnique({ where: { name } });
    if (existing && existing.userId !== userId) {
      return reply.status(403).send({ error: 'Service name taken by another user' });
    }

    let finalPort = port || 3000;
    let finalEnvVars = envVars || {};

    if (finalType === 'STATIC') finalPort = 80;
    if (finalType === 'POSTGRES') {
      finalPort = 5444;
      // Generate default credentials if not provided
      if (!finalEnvVars.POSTGRES_PASSWORD) {
        finalEnvVars = {
          ...finalEnvVars,
          POSTGRES_USER: 'postgres',
          POSTGRES_PASSWORD: crypto.randomBytes(16).toString('hex'),
          POSTGRES_DB: 'app',
        };
      }
    }
    if (finalType === 'REDIS') {
      finalPort = 6379;
      // Generate default Redis password if not provided
      if (!finalEnvVars.REDIS_PASSWORD) {
        finalEnvVars = {
          ...finalEnvVars,
          REDIS_PASSWORD: crypto.randomBytes(16).toString('hex'),
        };
      }
    }
    if (finalType === 'MYSQL') {
      finalPort = 3306;
      if (!finalEnvVars.MYSQL_ROOT_PASSWORD) {
        finalEnvVars = {
          ...finalEnvVars,
          MYSQL_ROOT_PASSWORD: crypto.randomBytes(16).toString('hex'),
          MYSQL_DATABASE: 'app',
        };
      }
    }

    return prisma.service.upsert({
      where: { name },
      update: {
        repoUrl,
        branch: branch || 'main',
        buildCommand,
        startCommand,
        port: finalPort,
        customDomain,
        type: finalType,
        staticOutputDir: staticOutputDir || 'dist',
        envVars: finalEnvVars,
      },
      create: {
        name,
        repoUrl: repoUrl || null,
        branch: branch || 'main',
        buildCommand,
        startCommand,
        port: finalPort,
        userId,
        customDomain,
        type: finalType,
        staticOutputDir: staticOutputDir || 'dist',
        envVars: finalEnvVars,
      },
    });
  },
);

fastify.delete('/services/:id', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!service) return reply.status(404).send({ error: 'Service not found or unauthorized' });

  // Check if service is protected from deletion
  if (service.deleteProtected) {
    return reply
      .status(403)
      .send({ error: 'Service is protected from deletion. Remove protection first.' });
  }

  // Perform soft deletion
  await prisma.service.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return { success: true, message: 'Service soft deleted. Can be recovered within 30 days.' };
});

// Recover a soft-deleted service
fastify.post('/services/:id/recover', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({
    where: { id, userId: user.id, deletedAt: { not: null } },
  });

  if (!service) {
    return reply.status(404).send({ error: 'Deleted service not found or unauthorized' });
  }

  // Restore the service
  const restored = await prisma.service.update({
    where: { id },
    data: { deletedAt: null },
  });

  return { success: true, service: restored, message: 'Service recovered successfully' };
});

// Toggle delete protection for a service
fastify.patch('/services/:id/protection', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;
  const { deleteProtected } = request.body as any;

  if (typeof deleteProtected !== 'boolean') {
    return reply.status(400).send({ error: 'deleteProtected must be a boolean' });
  }

  const service = await prisma.service.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });

  if (!service) {
    return reply.status(404).send({ error: 'Service not found or unauthorized' });
  }

  const updated = await prisma.service.update({
    where: { id },
    data: { deleteProtected },
  });

  return { success: true, service: updated };
});

fastify.get('/services/:id/health', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  const Docker = (await import('dockerode')).default;
  const docker = new Docker();

  const containers = await docker.listContainers({ all: true });
  const serviceContainers = containers.filter((c) => c.Labels['helvetia.serviceId'] === id);

  if (serviceContainers.length === 0) {
    return { status: 'NOT_RUNNING' };
  }

  const containerInfo = serviceContainers[0]; // Take the latest one
  const container = docker.getContainer(containerInfo.Id);
  const data = await container.inspect();

  return {
    status: data.State.Running ? 'RUNNING' : 'STOPPED',
    health: data.State.Health?.Status || 'UNKNOWN',
    startedAt: data.State.StartedAt,
    exitCode: data.State.ExitCode,
  };
});

fastify.get('/services/:id/metrics', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  return getServiceMetrics(id, undefined, undefined, service);
});

// SSE endpoint for real-time metrics streaming
fastify.get(
  '/services/metrics/stream',
  { config: { rateLimit: wsRateLimitConfig } },
  async (request, reply) => {
    const user = (request as any).user;

    // Set SSE headers with CORS support
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': getSafeOrigin(request.headers.origin),
      'Access-Control-Allow-Credentials': 'true',
    });

    console.log(`SSE client connected for real-time metrics: ${user.id}`);

    // Track connection state for better observability
    const connectionState = {
      isValid: true,
      startTime: Date.now(),
      metricsCount: 0,
      errorCount: 0,
    };

    // Store interval reference for cleanup
    let metricsInterval: NodeJS.Timeout | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;

    // Cleanup function to ensure all resources are freed
    const cleanup = () => {
      if (!connectionState.isValid) return; // Already cleaned up

      connectionState.isValid = false;

      if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
      }

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      console.log(
        `SSE metrics connection cleaned up for user ${user.id}. ` +
          `Duration: ${Date.now() - connectionState.startTime}ms, ` +
          `Metrics sent: ${connectionState.metricsCount}, ` +
          `Errors: ${connectionState.errorCount}`,
      );
    };

    const sendMetrics = async () => {
      // Check connection validity before proceeding
      if (!connectionState.isValid) {
        cleanup();
        return;
      }

      try {
        // Validate token before sending metrics
        const isValid = await validateToken(request);
        if (!isValid) {
          console.log(`Token expired for user ${user.id}, closing metrics stream`);
          // Send error event to client
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            console.error('Error writing token expiration message:', writeErr);
          }
          cleanup();
          return;
        }

        const Docker = (await import('dockerode')).default;
        const docker = new Docker();
        const containers = await docker.listContainers({ all: true });

        const services = await prisma.service.findMany({
          where: { userId: user.id, deletedAt: null },
          select: { id: true, name: true, type: true, status: true },
        });

        const metricsPromises = services.map(async (s) => ({
          id: s.id,
          metrics: await getServiceMetrics(s.id, docker, containers, s),
        }));

        const results = await Promise.all(metricsPromises);

        // Check if still valid before writing
        if (!connectionState.isValid) {
          cleanup();
          return;
        }

        // Send it as an SSE event
        reply.raw.write(`data: ${JSON.stringify(results)}\n\n`);
        connectionState.metricsCount++;
      } catch (err) {
        connectionState.errorCount++;
        console.error(`Error sending metrics via SSE (user ${user.id}):`, err);

        // If too many consecutive errors, close the connection
        if (connectionState.errorCount >= 3) {
          console.error(`Too many errors for user ${user.id}, closing connection`);
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            console.error('Error writing error message:', writeErr);
          }
          cleanup();
        }
      }
    };

    // Send immediate connection acknowledgment (makes it feel instant)
    reply.raw.write(': connected\n\n');

    // Fetch and send initial metrics asynchronously (non-blocking)
    await sendMetrics();

    // Set up periodic metrics updates
    metricsInterval = setInterval(async () => {
      if (!connectionState.isValid) {
        cleanup();
        return;
      }
      await sendMetrics();
    }, METRICS_UPDATE_INTERVAL_MS);

    // Implement connection timeout
    timeoutHandle = setTimeout(() => {
      console.log(`SSE metrics connection timeout for user ${user.id}`);
      try {
        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({ error: 'Connection timeout', code: 'TIMEOUT' })}\n\n`,
        );
        reply.raw.end();
      } catch (err) {
        console.error('Error writing timeout message:', err);
      }
      cleanup();
    }, CONNECTION_TIMEOUT_MS);

    // Clean up on client disconnect
    request.raw.on('close', () => {
      console.log(`SSE client disconnected from real-time metrics: ${user.id}`);
      cleanup();
    });

    // Clean up on error
    request.raw.on('error', (err) => {
      console.error(`SSE metrics connection error for user ${user.id}:`, err);
      cleanup();
    });

    reply.raw.on('error', (err) => {
      console.error(`SSE metrics reply error for user ${user.id}:`, err);
      cleanup();
    });

    // Keep the connection open
    return reply;
  },
);

// GitHub Proxy Routes
fastify.get('/github/orgs', async (request, reply) => {
  const user = (request as any).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  if (!dbUser?.githubAccessToken) {
    return reply.status(401).send({
      error:
        'GitHub authentication required or token expired. Please reconnect your GitHub account.',
    });
  }

  try {
    const decryptedToken = decrypt(dbUser.githubAccessToken);
    const res = await axios.get('https://api.github.com/user/orgs', {
      headers: {
        Authorization: `token ${decryptedToken}`,
        Accept: 'application/json',
      },
    });

    console.log(`Fetched ${res.data.length} organizations for user ${user.id}`);
    return res.data;
  } catch (err: any) {
    console.error('GitHub Orgs API error:', err.response?.data || err.message);
    return reply
      .status(err.response?.status || 500)
      .send(err.response?.data || { error: 'Failed to fetch GitHub organizations' });
  }
});

fastify.get('/github/repos', async (request, reply) => {
  const user = (request as any).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  if (!dbUser?.githubAccessToken) {
    return reply.status(401).send({
      error:
        'GitHub authentication required or token expired. Please reconnect your GitHub account.',
    });
  }

  const { sort, per_page, type, page, org } = request.query as any;

  // Validation and Sanitization
  const validSorts = ['updated', 'created', 'pushed', 'full_name'];
  const validTypes = ['all', 'owner', 'member', 'public', 'private', 'forks', 'sources'];

  const sanitizedSort = validSorts.includes(sort) ? sort : 'updated';
  const sanitizedType = validTypes.includes(type) ? type : 'all';
  const sanitizedPerPage = Math.max(1, Math.min(100, parseInt(per_page) || 100));
  const sanitizedPage = Math.max(1, parseInt(page) || 1);

  try {
    const decryptedToken = decrypt(dbUser.githubAccessToken);

    let url = 'https://api.github.com/user/repos';
    const params: any = {
      sort: sanitizedSort,
      per_page: sanitizedPerPage,
      page: sanitizedPage,
    };

    if (org) {
      // If org is provided, we fetch repos for that organization
      // Note: org repos API uses slightly different param names or defaults
      url = `https://api.github.com/orgs/${org}/repos`;
    } else {
      params.type = sanitizedType;
    }

    const res = await axios.get(url, {
      headers: {
        Authorization: `token ${decryptedToken}`,
        Accept: 'application/json',
      },
      params,
    });

    return res.data;
  } catch (err: any) {
    console.error('GitHub Repos API error:', err.response?.data || err.message);
    return reply
      .status(err.response?.status || 500)
      .send(err.response?.data || { error: 'Failed to fetch GitHub repositories' });
  }
});

fastify.get('/github/repos/:owner/:name/branches', async (request, reply) => {
  const user = (request as any).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  if (!dbUser?.githubAccessToken) {
    return reply.status(401).send({
      error:
        'GitHub authentication required or token expired. Please reconnect your GitHub account.',
    });
  }

  const { owner, name } = request.params as any;

  // Validation: owner and name should only contain alphanumeric, hyphens, underscores, or dots
  const validPattern = /^[a-zA-Z0-9-._]+$/;
  if (!validPattern.test(owner) || !validPattern.test(name)) {
    return reply.status(400).send({ error: 'Invalid repository owner or name format' });
  }

  try {
    const decryptedToken = decrypt(dbUser.githubAccessToken);
    const res = await axios.get(`https://api.github.com/repos/${owner}/${name}/branches`, {
      headers: {
        Authorization: `token ${decryptedToken}`,
        Accept: 'application/json',
      },
    });

    return res.data;
  } catch (err: any) {
    console.error('GitHub API error:', err.response?.data || err.message);
    return reply
      .status(err.response?.status || 500)
      .send(err.response?.data || { error: 'Failed to fetch branches' });
  }
});

// Deployment Routes
fastify.post(
  '/services/:id/deploy',
  { config: { rateLimit: wsRateLimitConfig } },
  async (request, reply) => {
    const { id } = request.params as any;
    const user = (request as any).user;

    const service = await prisma.service.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });
    if (!service) return reply.status(404).send({ error: 'Service not found' });

    const deployment = await prisma.deployment.create({
      data: {
        serviceId: id,
        status: 'QUEUED',
      },
    });

    // Update service status to DEPLOYING with distributed lock
    await withStatusLock(id, async () => {
      await prisma.service.update({
        where: { id },
        data: { status: 'DEPLOYING' },
      });
    });

    // Inject token if available
    let repoUrl = service.repoUrl;
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (dbUser?.githubAccessToken && repoUrl && repoUrl.includes('github.com')) {
      const decryptedToken = decrypt(dbUser.githubAccessToken);
      repoUrl = repoUrl.replace('https://', `https://${decryptedToken}@`);
    }

    await deploymentQueue.add('build', {
      deploymentId: deployment.id,
      serviceId: service.id,
      repoUrl,
      branch: service.branch,
      buildCommand: service.buildCommand,
      startCommand: service.startCommand,
      serviceName: service.name,
      port: service.port,
      envVars: service.envVars,
      customDomain: (service as any).customDomain,
      type: (service as any).type,
      staticOutputDir: (service as any).staticOutputDir,
    });

    return deployment;
  },
);

// Restart a container without rebuilding
fastify.post('/services/:id/restart', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  if ((service as any).type === 'COMPOSE') {
    return reply.status(400).send({
      error:
        'Please use "Redeploy" for Docker Compose services to apply environment variables and configuration changes correctly.',
    });
  }

  const Docker = (await import('dockerode')).default;
  const docker = new Docker();

  try {
    // Find existing containers for this service
    const containers = await docker.listContainers({ all: true });
    const serviceContainers = containers.filter((c) => c.Labels['helvetia.serviceId'] === id);

    if (serviceContainers.length === 0) {
      return reply.status(404).send({ error: 'No running container found. Please deploy first.' });
    }

    // Get the image tag from the first container
    const existingContainer = docker.getContainer(serviceContainers[0].Id);
    const containerInfo = await existingContainer.inspect();
    const imageTag = containerInfo.Config.Image;

    // Generate a new container name
    const postfix = Math.random().toString(36).substring(2, 8);
    const containerName = `${service.name}-${postfix}`;

    const traefikRule = (service as any).customDomain
      ? `Host(\`${service.name}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${service.name}.localhost\`) || Host(\`${(service as any).customDomain}\`)`
      : `Host(\`${service.name}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${service.name}.localhost\`)`;

    // Create new container with updated config
    const newContainer = await docker.createContainer({
      Image: imageTag,
      name: containerName,
      Env: service.envVars ? Object.entries(service.envVars).map(([k, v]) => `${k}=${v}`) : [],
      Cmd:
        (service as any).type === 'REDIS' &&
        (service.envVars as Record<string, any>)?.REDIS_PASSWORD
          ? [
              'redis-server',
              '--requirepass',
              (service.envVars as Record<string, any>).REDIS_PASSWORD,
            ]
          : undefined,
      Labels: {
        'helvetia.serviceId': service.id,
        'helvetia.type': (service as any).type || 'DOCKER',
        'traefik.enable': 'true',
        [`traefik.http.routers.${service.name}.rule`]: traefikRule,
        [`traefik.http.routers.${service.name}.entrypoints`]: 'web',
        [`traefik.http.services.${service.name}.loadbalancer.server.port`]: (
          service.port || getDefaultPortForServiceType((service as any).type || 'DOCKER')
        ).toString(),
      },
      HostConfig: {
        NetworkMode: 'helvetia-net',
        RestartPolicy: { Name: 'always' },
        Memory: CONTAINER_MEMORY_LIMIT_BYTES,
        NanoCpus: CONTAINER_CPU_NANOCPUS,
        Binds:
          (service as any).type === 'POSTGRES'
            ? [`helvetia-data-${service.name}:/var/lib/postgresql/data`]
            : (service as any).type === 'REDIS'
              ? [`helvetia-data-${service.name}:/data`]
              : (service as any).type === 'MYSQL'
                ? [`helvetia-data-${service.name}:/var/lib/mysql`]
                : [],
        LogConfig: {
          Type: 'json-file',
          Config: {},
        },
      },
    });

    await newContainer.start();

    // Stop and remove old containers
    for (const old of serviceContainers) {
      const container = docker.getContainer(old.Id);
      await container.stop().catch(() => {});
      await container.remove().catch(() => {});
    }

    return { success: true, message: 'Container restarted successfully' };
  } catch (error) {
    console.error('Restart error:', error);
    return reply.status(500).send({ error: 'Failed to restart container' });
  }
});

// Webhook scope to capture raw body
fastify.register(async (scope) => {
  scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as any).rawBody = body;
    try {
      const json = JSON.parse(body.toString());
      done(null, json);
    } catch (err: any) {
      done(err, undefined);
    }
  });

  scope.post(
    '/webhooks/github',
    {
      config: { rateLimit: authRateLimitConfig },
      bodyLimit: BODY_LIMIT_STANDARD, // 1MB limit for webhook payloads
    },
    async (request, reply) => {
      // Verify GitHub webhook signature
      const signature = request.headers['x-hub-signature-256'] as string;
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error('GITHUB_WEBHOOK_SECRET is not configured');
        return reply.status(500).send({ error: 'Webhook secret not configured' });
      }

      if (!signature) {
        console.warn('GitHub webhook received without signature', {
          ip: request.ip,
          headers: request.headers,
        });
        return reply.status(401).send({ error: 'Missing signature' });
      }

      // Get raw body for signature verification
      const rawBody = (request as any).rawBody;

      if (!rawBody) {
        console.warn('GitHub webhook received without raw body');
        return reply.status(400).send({ error: 'Missing raw body' });
      }

      if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
        console.warn('GitHub webhook signature verification failed', {
          ip: request.ip,
          signature: signature.substring(0, 20) + '...',
        });
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const payload = request.body as any;

      // Handle Pull Request events
      if (payload.pull_request) {
        try {
          const pr = payload.pull_request;
          const action = payload.action;
          const prNumber = payload.number;
          const repoUrl = pr.base.repo.html_url;
          const headBranch = pr.head.ref;

          console.log(`Received GitHub PR webhook: PR #${prNumber} ${action} on ${repoUrl}`);

          if (['opened', 'synchronize'].includes(action)) {
            // Find the base service for this repo (the one that isn't a preview)
            const baseService = await prisma.service.findFirst({
              where: {
                ...getRepoUrlMatchCondition(repoUrl),
                isPreview: false,
                deletedAt: null,
              },
            });

            if (!baseService) {
              console.log(`No base service found for ${repoUrl}, skipping preview deployment`);
              return { skipped: 'No base service found' };
            }

            const previewName = `${baseService.name}-pr-${prNumber}`;

            // Upsert the preview service
            const service = await prisma.service.upsert({
              where: { name: previewName },
              update: {
                branch: headBranch,
                status: 'IDLE',
              },
              create: {
                name: previewName,
                repoUrl: baseService.repoUrl,
                branch: headBranch,
                buildCommand: baseService.buildCommand,
                startCommand: baseService.startCommand,
                port: baseService.port,
                type: baseService.type,
                staticOutputDir: baseService.staticOutputDir,
                envVars: baseService.envVars || {},
                userId: baseService.userId,
                isPreview: true,
                prNumber: prNumber,
              },
            });

            console.log(`Triggering preview deployment for ${service.name}`);

            await createAndQueueDeployment(service, pr.head.sha);

            return { success: true, previewService: service.name };
          }

          if (action === 'closed') {
            const previewService = await prisma.service.findFirst({
              where: {
                prNumber: prNumber,
                ...getRepoUrlMatchCondition(repoUrl),
                isPreview: true,
                deletedAt: null,
              },
            });

            if (previewService) {
              console.log(`Cleaning up preview environment for PR #${prNumber}`);
              await deleteService(previewService.id, previewService.userId);
              return { success: true, deletedService: previewService.name };
            }
            return { skipped: 'No preview service found to delete' };
          }

          return { skipped: `Action ${action} not handled` };
        } catch (error) {
          console.error('Error handling GitHub PR webhook:', error);
          return { error: 'Internal server error while processing webhook' };
        }
      }

      // Basic check for push event
      if (!payload.repository || !payload.ref) {
        return { skipped: 'Not a push or PR event' };
      }

      const repoUrl = payload.repository.html_url;
      const branch = payload.ref.replace('refs/heads/', '');

      console.log(`Received GitHub push webhook for ${repoUrl} on branch ${branch}`);

      // Find service(s) matching this repo and branch
      const services = await prisma.service.findMany({
        where: {
          ...getRepoUrlMatchCondition(repoUrl),
          branch,
          isPreview: false, // Only trigger non-preview services for push events
          deletedAt: null,
        },
      });

      if (services.length === 0) {
        console.log(`No service found for ${repoUrl} on branch ${branch}`);
        return { skipped: 'No matching service found' };
      }

      for (const service of services) {
        console.log(`Triggering automated deployment for ${service.name}`);

        await createAndQueueDeployment(service, payload.after);
      }

      return { success: true, servicesTriggered: services.length };
    },
  );
});

fastify.get('/services/:id/deployments', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  // Verify ownership
  const service = await prisma.service.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  return prisma.deployment.findMany({
    where: { serviceId: id },
    orderBy: { createdAt: 'desc' },
  });
});

fastify.get('/deployments/:id/logs', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { service: true },
  });

  if (!deployment || deployment.service.userId !== user.id) {
    return reply.status(404).send({ error: 'Deployment not found or unauthorized' });
  }
  return { logs: deployment?.logs };
});

// SSE endpoint for real-time deployment logs
fastify.get(
  '/deployments/:id/logs/stream',
  { config: { rateLimit: wsRateLimitConfig } },
  async (request, reply) => {
    const { id } = request.params as any;
    const user = (request as any).user;

    // Verify deployment belongs to user
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: { service: true },
    });

    if (!deployment || deployment.service.userId !== user.id) {
      return reply.status(404).send({ error: 'Deployment not found or unauthorized' });
    }

    // Set SSE headers with CORS support
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': getSafeOrigin(request.headers.origin),
      'Access-Control-Allow-Credentials': 'true',
    });

    console.log(`SSE client connected for live logs: ${id}`);

    // Track connection state for better observability
    const connectionState = {
      isValid: true,
      startTime: Date.now(),
      messagesReceived: 0,
      validationAttempts: 0,
      errorCount: 0,
    };

    // Store interval references for cleanup
    let tokenValidationInterval: NodeJS.Timeout | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let isSubscribed = false;

    // Cleanup function to ensure all resources are freed
    const cleanup = async () => {
      if (!connectionState.isValid) return; // Already cleaned up

      connectionState.isValid = false;

      if (tokenValidationInterval) {
        clearInterval(tokenValidationInterval);
        tokenValidationInterval = null;
      }

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      // Clean up Redis subscription
      if (isSubscribed) {
        try {
          subConnection.removeListener('message', onMessage);
          await subConnection.unsubscribe(channel);
          isSubscribed = false;
        } catch (err) {
          console.error(`Error unsubscribing from channel ${channel}:`, err);
        }
      }

      console.log(
        `SSE logs connection cleaned up for deployment ${id}. ` +
          `Duration: ${Date.now() - connectionState.startTime}ms, ` +
          `Messages: ${connectionState.messagesReceived}, ` +
          `Validations: ${connectionState.validationAttempts}, ` +
          `Errors: ${connectionState.errorCount}`,
      );
    };

    const channel = `deployment-logs:${id}`;

    const onMessage = (chan: string, message: string) => {
      if (!connectionState.isValid) return;
      if (chan === channel) {
        try {
          // Send log line as an SSE event
          reply.raw.write(`data: ${message}\n\n`);
          connectionState.messagesReceived++;
        } catch (err) {
          connectionState.errorCount++;
          console.error(`Error writing log message for deployment ${id}:`, err);

          // If write fails, connection is likely broken
          if (connectionState.errorCount >= 3) {
            console.error(`Too many write errors for deployment ${id}, closing connection`);
            void cleanup();
          }
        }
      }
    };

    // Set up periodic token validation (every 30 seconds)
    tokenValidationInterval = setInterval(async () => {
      if (!connectionState.isValid) {
        await cleanup();
        return;
      }

      try {
        connectionState.validationAttempts++;
        const isValid = await validateToken(request);
        if (!isValid) {
          console.log(`Token expired for user ${user.id}, closing logs stream`);
          // Send error event to client
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            console.error('Error writing token expiration message:', writeErr);
          }
          await cleanup();
        }
      } catch (err) {
        connectionState.errorCount++;
        console.error(`Error during token validation for deployment ${id}:`, err);

        // If validation fails repeatedly, close connection
        if (connectionState.errorCount >= 3) {
          console.error(`Too many validation errors for deployment ${id}, closing connection`);
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            console.error('Error writing error message:', writeErr);
          }
          await cleanup();
        }
      }
    }, 30000); // Check every 30 seconds

    // Subscribe to Redis channel for logs
    try {
      await subConnection.subscribe(channel);
      isSubscribed = true;
      subConnection.on('message', onMessage);
    } catch (err) {
      console.error(`Error subscribing to channel ${channel}:`, err);
      return reply.status(500).send({ error: 'Failed to establish log stream' });
    }

    // Implement connection timeout (60 minutes for logs)
    const CONNECTION_TIMEOUT_MS = 60 * 60 * 1000;
    timeoutHandle = setTimeout(async () => {
      console.log(`SSE logs connection timeout for deployment ${id}`);
      try {
        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({ error: 'Connection timeout', code: 'TIMEOUT' })}\n\n`,
        );
        reply.raw.end();
      } catch (err) {
        console.error('Error writing timeout message:', err);
      }
      await cleanup();
    }, CONNECTION_TIMEOUT_MS);

    // Clean up on client disconnect
    request.raw.on('close', async () => {
      console.log(`SSE client disconnected from live logs: ${id}`);
      await cleanup();
    });

    // Clean up on error
    request.raw.on('error', async (err) => {
      console.error(`SSE logs connection error for deployment ${id}:`, err);
      await cleanup();
    });

    reply.raw.on('error', async (err) => {
      console.error(`SSE logs reply error for deployment ${id}:`, err);
      await cleanup();
    });

    // Keep the connection open
    return reply;
  },
);

// Removed auto-start for testing
// const start = async () => {
//   try {
//     await fastify.listen({ port: 3001, host: '0.0.0.0' });
//   } catch (err) {
//     fastify.log.error(err);
//     process.exit(1);
//   }
// };
//
// start();
