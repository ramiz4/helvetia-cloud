import './load-env';

/* eslint-disable @typescript-eslint/no-explicit-any */
import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import axios from 'axios';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import Fastify from 'fastify';
import IORedis from 'ioredis';
import {
  BODY_LIMIT_GLOBAL,
  BODY_LIMIT_SMALL,
  BODY_LIMIT_STANDARD,
  LOG_LEVEL,
  LOG_REDACT_PATHS,
  LOG_REQUESTS,
  LOG_RESPONSES,
} from './config/constants';
import { createRateLimitConfigs } from './config/rateLimit';
import { initializeContainer, registerInstance, resolve, TOKENS } from './di';
import type { IDeploymentRepository, IServiceRepository, IUserRepository } from './interfaces';
import { metricsService } from './services/metrics.service';
import { encrypt } from './utils/crypto';
import { getAllowedOrigins, getSafeOrigin, isOriginAllowed } from './utils/helpers/cors.helper';
import {
  createRefreshToken,
  revokeAllUserRefreshTokens,
  verifyAndRotateRefreshToken,
} from './utils/refreshToken';

// Initialize DI container
initializeContainer();

// Resolve repositories
const serviceRepository = resolve<IServiceRepository>(TOKENS.ServiceRepository);
const deploymentRepository = resolve<IDeploymentRepository>(TOKENS.DeploymentRepository);
const userRepository = resolve<IUserRepository>(TOKENS.UserRepository);

// Redis connection initialized after dotenv.config()
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const deploymentQueue = new Queue('deployments', {
  connection: redisConnection,
});

// Register deployment queue in DI container after creation
registerInstance(TOKENS.DeploymentQueue, deploymentQueue);

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

/**
 * Logger Configuration
 *
 * Fastify uses Pino for logging with the following features:
 * - Automatic request ID generation for correlation
 * - Structured JSON logging in production
 * - Pretty printing in development
 * - Configurable log levels per environment
 * - Sensitive data redaction
 *
 * Log Levels (in order of verbosity):
 * - fatal: Application crash (level 60)
 * - error: Errors that need attention (level 50)
 * - warn: Warning conditions (level 40)
 * - info: General informational messages (level 30) - default
 * - debug: Debug messages (level 20)
 * - trace: Very detailed debug messages (level 10)
 *
 * Request/Response Logging:
 * - Each request is assigned a unique request ID (reqId)
 * - Request logging includes: method, url, query params, user ID, IP
 * - Response logging includes: statusCode, responseTime (ms), request ID
 * - Sensitive headers (Authorization, Cookie) are automatically redacted
 *
 * Environment Variables:
 * - LOG_LEVEL: Set log level (default: 'info')
 * - LOG_REQUESTS: Enable request logging (default: true)
 * - LOG_RESPONSES: Enable response logging (default: true)
 */
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
const isDevelopment = process.env.NODE_ENV === 'development';

export const fastify = Fastify({
  logger: isTestEnv
    ? false
    : {
        level: LOG_LEVEL,
        // Use pretty printing in development, JSON in production
        transport: isDevelopment
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
                colorize: true,
                singleLine: false,
              },
            }
          : undefined,
        // Redact sensitive information
        redact: {
          paths: LOG_REDACT_PATHS,
          remove: true,
        },
        // Serialize errors properly
        serializers: {
          req(request) {
            return {
              method: request.method,
              url: request.url,
              path: request.routeOptions?.url,
              params: request.params,
              query: request.query,
              headers: {
                host: request.headers.host,
                'user-agent': request.headers['user-agent'],
                'content-type': request.headers['content-type'],
              },
              remoteAddress: request.ip,
              userId: (request as any).user?.id,
            };
          },
          res(reply) {
            return {
              statusCode: reply.statusCode,
            };
          },
          err(error) {
            return {
              type: error.name,
              message: error.message,
              stack: error.stack || '',
              code: (error as any).code,
              statusCode: (error as any).statusCode,
            };
          },
        },
      },
  bodyLimit: BODY_LIMIT_GLOBAL,
  // Generate unique request IDs for correlation
  genReqId: (req) => {
    // Use existing request ID header if provided, otherwise generate new one
    return (req.headers['x-request-id'] as string) || crypto.randomUUID();
  },
  // Disable automatic request logging (we'll do it manually for more control)
  disableRequestLogging: !LOG_REQUESTS && !LOG_RESPONSES,
});

// Store redis connection on fastify instance for route access
(fastify as any).redis = redisConnection;

// Export CORS helper functions and body limits for testing
export {
  BODY_LIMIT_GLOBAL,
  BODY_LIMIT_SMALL,
  BODY_LIMIT_STANDARD,
  getAllowedOrigins,
  getSafeOrigin,
  isOriginAllowed,
};

// Collect queue metrics periodically (every 30 seconds)
if (!isTestEnv) {
  setInterval(async () => {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        deploymentQueue.getWaitingCount(),
        deploymentQueue.getActiveCount(),
        deploymentQueue.getCompletedCount(),
        deploymentQueue.getFailedCount(),
      ]);
      metricsService.updateQueueDepth('deployments', waiting, active, completed, failed);
    } catch (error) {
      console.error('Failed to collect queue metrics:', error);
    }
  }, 30000);
}

/**
 * Request Logging Hook
 *
 * Logs incoming requests with structured context including:
 * - Request ID for correlation across logs
 * - HTTP method and URL
 * - User ID (if authenticated)
 * - Client IP address
 * - Query parameters and route path
 *
 * This hook runs before request processing begins.
 */
if (LOG_REQUESTS && !isTestEnv) {
  fastify.addHook('onRequest', async (request, reply) => {
    const user = (request as any).user;
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        path: request.routeOptions?.url,
        query: request.query,
        userId: user?.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
      `Incoming request: ${request.method} ${request.url}`,
    );
  });
}

/**
 * Response Logging Hook
 *
 * Logs outgoing responses with structured context including:
 * - Request ID for correlation
 * - HTTP status code
 * - Response time in milliseconds
 * - Error information (if applicable)
 *
 * This hook runs after the response is sent to the client.
 */
if (LOG_RESPONSES && !isTestEnv) {
  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = reply.elapsedTime.toFixed(2);
    const level = reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info';

    request.log[level](
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: `${responseTime}ms`,
        userId: (request as any).user?.id,
      },
      `Request completed: ${request.method} ${request.url} - ${reply.statusCode} (${responseTime}ms)`,
    );
  });
}

/**
 * Metrics Collection Hook
 *
 * Collects metrics for all HTTP requests:
 * - Request count by method, route, and status code
 * - Request duration histogram
 * - Requests in progress gauge
 *
 * This hook tracks requests in flight and records timing after completion.
 */
fastify.addHook('onRequest', async (request, _reply) => {
  // Track in-progress requests
  const route = request.routeOptions?.url || request.url;
  (request as any).metricsEndTimer = metricsService.startHttpRequest(request.method, route);
});

fastify.addHook('onResponse', async (request, reply) => {
  // Record completed request metrics
  const route = request.routeOptions?.url || request.url;
  const endTimer = (request as any).metricsEndTimer;

  if (endTimer) {
    const duration = endTimer();
    metricsService.recordHttpRequest(request.method, route, reply.statusCode, duration);
  }
});

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
  max: isTestEnv ? 10000 : parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
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

// Create rate limit configs
const { authRateLimitConfig } = createRateLimitConfigs(redisConnection);

// Register global error handler
import { errorHandler } from './middleware/error.middleware';
fastify.setErrorHandler(errorHandler);

// Auth hook
fastify.addHook('onRequest', async (request, reply) => {
  const publicRoutes = [
    '/health',
    '/metrics',
    '/metrics/json',
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

// Register metrics routes
import { metricsRoutes } from './routes/metrics.routes';
fastify.register(metricsRoutes);

// Register service routes
import { serviceRoutes } from './routes/service.routes';
fastify.register(serviceRoutes);

// Register deployment routes
import { deploymentRoutes } from './routes/deployment.routes';
fastify.register(deploymentRoutes);

// Register GitHub routes
import { githubRoutes } from './routes/github.routes';
fastify.register(githubRoutes);

// Register webhook routes
import { webhookRoutes } from './routes/webhook.routes';
fastify.register(webhookRoutes);

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
      const user = await userRepository.upsert(
        { githubId: githubUser.id.toString() },
        {
          githubId: githubUser.id.toString(),
          username: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          githubAccessToken: encryptedToken,
        },
        {
          username: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          githubAccessToken: encryptedToken,
        },
      );

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
  const dbUser = await userRepository.findById(user.id);

  return {
    ...dbUser,
    isGithubConnected: !!dbUser?.githubAccessToken,
    githubAccessToken: undefined, // Don't send the token itself
  };
});

fastify.delete('/auth/github/disconnect', async (request) => {
  const user = (request as any).user;
  await userRepository.update(user.id, { githubAccessToken: null });
  return { success: true };
});

// Export a factory function for testing
export async function buildServer() {
  return fastify;
}

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
