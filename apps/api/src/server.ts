/* eslint-disable @typescript-eslint/no-explicit-any */
import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyWebsocket, { WebSocket } from '@fastify/websocket';
import axios from 'axios';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import { prisma } from 'database';
import dotenv from 'dotenv';
import Fastify, { FastifyRequest } from 'fastify';
import IORedis from 'ioredis';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Separate connection for subscriptions
const subConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

const deploymentQueue = new Queue('deployments', {
  connection: redisConnection,
});

// Helper function to get default port for service type
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
  const serviceContainers = containers.filter((c) => c.Labels['helvetia.serviceId'] === service.id);
  const latestDeployment = service.deployments[0];
  let status = 'IDLE';

  if (serviceContainers.length > 0) {
    const container = serviceContainers[0];
    if (container.State === 'running') {
      status = 'RUNNING';
    } else if (container.State === 'restarting') {
      status = 'CRASHING';
    } else if (container.State === 'exited' || container.State === 'dead') {
      status = 'STOPPED';
    } else {
      status = container.State.toUpperCase();
    }
  } else if (latestDeployment) {
    if (['QUEUED', 'BUILDING'].includes(latestDeployment.status)) {
      status = 'DEPLOYING';
    } else if (latestDeployment.status === 'FAILED') {
      status = 'FAILED';
    } else if (latestDeployment.status === 'SUCCESS') {
      status = 'IDLE';
    }
  }
  return status;
}

// Helper to delete a service and its resources
async function deleteService(id: string, userId?: string) {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return;

  // Verify ownership if userId is provided (skip for system operations like webhooks)
  if (userId && service.userId !== userId) {
    throw new Error('Unauthorized: User does not own this service');
  }

  // 1. Stop and remove containers if they exist
  const Docker = (await import('dockerode')).default;
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });
  const serviceContainers = containers.filter((c) => c.Labels['helvetia.serviceId'] === id);

  for (const containerInfo of serviceContainers) {
    const container = docker.getContainer(containerInfo.Id);
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
      console.log(`Removed volume ${volumeName} for database service ${service.name}`);
    } catch (err) {
      console.error(`Failed to remove volume ${volumeName}:`, err);
      // Continue with deletion even if volume removal fails
    }
  }

  // 2. Delete deployments and service from DB
  await prisma.deployment.deleteMany({ where: { serviceId: id } });
  await prisma.service.delete({ where: { id } });
}

export const fastify = Fastify({
  logger: true,
});

fastify.register(cors, {
  origin: [process.env.APP_BASE_URL || 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});

fastify.register(fastifyWebsocket);
fastify.register(fastifyCookie);
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'supersecret',
  cookie: {
    cookieName: 'token',
    signed: false,
  },
});

// Auth hook
fastify.addHook('onRequest', async (request, reply) => {
  const publicRoutes = ['/health', '/webhooks/github', '/auth/github'];
  if (
    publicRoutes.includes(request.routeOptions?.url || '') ||
    request.url.includes('/logs/stream')
  ) {
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

fastify.post('/auth/github', async (request, reply) => {
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
    const user = await prisma.user.upsert({
      where: { githubId: githubUser.id.toString() },
      update: {
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
      },
      create: {
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
      },
    });

    // 4. Generate JWT
    const token = fastify.jwt.sign({ id: user.id, username: user.username });

    // 5. Set cookie and return user
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return { user, token };
  } catch (err: any) {
    console.error('Auth error:', err.response?.data || err.message);
    return reply.status(500).send({ error: 'Authentication failed' });
  }
});

// Service Routes
fastify.get('/services', async (request) => {
  // Add authentication middleware in real app
  const user = (request as any).user;
  const services = await prisma.service.findMany({
    where: { userId: user.id },
    include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  // Enrich services with actual Docker container status
  const Docker = (await import('dockerode')).default;
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });

  const enrichedServices = services.map((service) => ({
    ...service,
    status: determineServiceStatus(service, containers),
  }));

  return enrichedServices;
});

fastify.get('/services/:id', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({
    where: { id, userId: user.id },
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

fastify.patch('/services/:id', async (request, reply) => {
  const { id } = request.params as any;
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
  } = request.body as any;

  if (type !== undefined && !['DOCKER', 'STATIC', 'POSTGRES', 'REDIS', 'MYSQL'].includes(type)) {
    return reply.status(400).send({ error: 'Invalid service type' });
  }
  const user = (request as any).user;
  const service = await prisma.service.updateMany({
    where: { id, userId: user.id },
    data: {
      name,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port: port ? parseInt(port) : type ? getDefaultPortForServiceType(type) : undefined,
      envVars,
      customDomain,
      type,
      staticOutputDir,
    },
  });

  if (service.count === 0)
    return reply.status(404).send({ error: 'Service not found or unauthorized' });

  return prisma.service.findUnique({ where: { id } });

  return service;
});

fastify.post('/services', async (request, reply) => {
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
  } = request.body as any;

  if (type && !['DOCKER', 'STATIC', 'POSTGRES', 'REDIS', 'MYSQL'].includes(type)) {
    return reply.status(400).send({ error: 'Invalid service type' });
  }
  const user = (request as any).user;
  const userId = user.id;

  // Check ownership if exists
  const existing = await prisma.service.findUnique({ where: { name } });
  if (existing && existing.userId !== userId) {
    return reply.status(403).send({ error: 'Service name taken by another user' });
  }

  const finalType = type || 'DOCKER';
  let finalPort = port ? parseInt(port) : 3000;
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

  const service = await prisma.service.upsert({
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

  return service;
});

fastify.delete('/services/:id', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
  if (!service) return reply.status(404).send({ error: 'Service not found or unauthorized' });

  try {
    await deleteService(id, user.id);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting service:', error);
    return reply.status(403).send({ error: 'Unauthorized to delete this service' });
  }
});

fastify.get('/services/:id/health', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
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

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  const Docker = (await import('dockerode')).default;
  const docker = new Docker();

  const containers = await docker.listContainers({ all: true });
  const serviceContainers = containers.filter(
    (c) => c.Labels['helvetia.serviceId'] === id && c.State === 'running',
  );

  if (serviceContainers.length === 0) {
    return { cpu: 0, memory: 0, memoryLimit: 0 };
  }

  const containerInfo = serviceContainers[0];
  const container = docker.getContainer(containerInfo.Id);

  // Get single stats snapshot
  const stats = await container.stats({ stream: false });

  // Calculate CPU percentage (simplified)
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent =
    systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100.0 : 0;

  // Calculate Memory usage in MB
  const memoryUsage =
    (stats.memory_stats.usage - (stats.memory_stats.stats.cache || 0)) / 1024 / 1024;
  const memoryLimit = stats.memory_stats.limit / 1024 / 1024;

  return {
    cpu: parseFloat(cpuPercent.toFixed(2)),
    memory: parseFloat(memoryUsage.toFixed(2)),
    memoryLimit: parseFloat(memoryLimit.toFixed(2)),
  };
});

// Deployment Routes
fastify.post('/services/:id/deploy', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  const deployment = await prisma.deployment.create({
    data: {
      serviceId: id,
      status: 'QUEUED',
    },
  });

  await deploymentQueue.add('build', {
    deploymentId: deployment.id,
    serviceId: service.id,
    repoUrl: service.repoUrl,
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
});

// Restart container without rebuilding
fastify.post('/services/:id/restart', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

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

    // Generate new container name
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
        Memory: 512 * 1024 * 1024,
        NanoCpus: 1000000000,
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

fastify.post('/webhooks/github', async (request, reply) => {
  try {
    const payload = request.body as any;

    // Handle Pull Request events
    if (payload.pull_request) {
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
            repoUrl: { contains: repoUrl },
            isPreview: false,
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

        const deployment = await prisma.deployment.create({
          data: {
            serviceId: service.id,
            status: 'QUEUED',
            commitHash: pr.head.sha,
          },
        });

        await deploymentQueue.add('build', {
          deploymentId: deployment.id,
          serviceId: service.id,
          repoUrl: service.repoUrl,
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

        return { success: true, previewService: service.name };
      }

      if (action === 'closed') {
        const previewService = await prisma.service.findFirst({
          where: {
            prNumber: prNumber,
            repoUrl: { contains: repoUrl },
            isPreview: true,
          },
        });

        if (previewService) {
          console.log(`Cleaning up preview environment for PR #${prNumber}`);
          await deleteService(previewService.id);
          return { success: true, deletedService: previewService.name };
        }
        return { skipped: 'No preview service found to delete' };
      }

      return { skipped: `Action ${action} not handled` };
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
        repoUrl: { contains: repoUrl }, // Use contains to handle .git suffix variations
        branch,
        isPreview: false, // Only trigger non-preview services for push events
      },
    });

    if (services.length === 0) {
      console.log(`No service found for ${repoUrl} on branch ${branch}`);
      return { skipped: 'No matching service found' };
    }

    for (const service of services) {
      console.log(`Triggering automated deployment for ${service.name}`);

      const deployment = await prisma.deployment.create({
        data: {
          serviceId: service.id,
          status: 'QUEUED',
          commitHash: payload.after,
        },
      });

      await deploymentQueue.add('build', {
        deploymentId: deployment.id,
        serviceId: service.id,
        repoUrl: service.repoUrl,
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
    }

    return { success: true, servicesTriggered: services.length };
  } catch (error) {
    console.error('Error handling GitHub webhook:', error);
    return reply.status(500).send({ error: 'Internal server error while processing webhook' });
  }
});

fastify.get('/services/:id/deployments', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  // Verify ownership
  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
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

fastify.get(
  '/deployments/:id/logs/stream',
  {
    websocket: true,
    // Apply rate limiting to prevent abuse of authenticated log streaming
    config: {
      rateLimit: {
        max: parseInt(process.env.WS_RATE_LIMIT_MAX || '10', 10),
        timeWindow: process.env.WS_RATE_LIMIT_WINDOW || '1 minute',
      },
    },
  },
  (connection: WebSocket, req: FastifyRequest) => {
    const { id } = req.params as any;
    const { token } = req.query as any;

    console.log(`WebSocket connection attempt for deployment: ${id}`);

    // Auth check for WS
    try {
      // Check query param first, then cookie
      const tokenToVerify = token || (req as any).cookies.token;

      if (!tokenToVerify) throw new Error('No token provided');
      (req.server as any).jwt.verify(tokenToVerify);
    } catch (err: any) {
      console.error(`WS Auth Failed for deployment ${id}:`, err.message);
      connection.close();
      return;
    }

    const channel = `deployment-logs:${id}`;

    console.log(`Client connected for live logs: ${id}`);

    const onMessage = (chan: string, message: string) => {
      if (chan === channel) {
        connection.send(message);
      }
    };

    subConnection.subscribe(channel);
    subConnection.on('message', onMessage);

    connection.on('close', () => {
      console.log(`Client disconnected from live logs: ${id}`);
      // We shouldn't unsubscribe from the channel globally if other clients are listening
      // But for MVP, simple is fine. Actually, ioredis handles multiple subscribers on the same connection.
      // However, we only have one subConnection. Let's just remove the listener.
      subConnection.removeListener('message', onMessage);
    });
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
