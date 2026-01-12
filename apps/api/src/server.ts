import './load-env';
import './types/fastify';

import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

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
import { initializeContainer, registerInstance, resolve, TOKENS } from './di';
import { UnauthorizedError } from './errors';
import type { IDeploymentRepository, IServiceRepository } from './interfaces';
import { metricsService } from './services/metrics.service';
import { getAllowedOrigins, getSafeOrigin, isOriginAllowed } from './utils/helpers/cors.helper';

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
const isDevelopment = process.env.NODE_ENV === 'development';

// Initialize DI container
initializeContainer();

// Resolve repositories
resolve<IServiceRepository>(TOKENS.ServiceRepository);
resolve<IDeploymentRepository>(TOKENS.DeploymentRepository);

// Redis connection initialized after dotenv.config()
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const deploymentQueue = new Queue(isTestEnv ? 'deployments-test' : 'deployments', {
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
              userId: request.user?.id,
            };
          },
          res(reply) {
            return {
              statusCode: reply.statusCode,
            };
          },
          err(error: Error & { code?: string; statusCode?: number }) {
            return {
              type: error.name,
              message: error.message,
              stack: error.stack || '',
              code: error.code,
              statusCode: error.statusCode,
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
fastify.redis = redisConnection;

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
  fastify.addHook('onRequest', async (request, _reply) => {
    const user = request.user;
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
        userId: request.user?.id,
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
  request.metricsEndTimer = metricsService.startHttpRequest(request.method, route);
});

fastify.addHook('onResponse', async (request, reply) => {
  // Record completed request metrics
  const route = request.routeOptions?.url || request.url;
  const endTimer = request.metricsEndTimer;

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
// const { authRateLimitConfig } = createRateLimitConfigs(redisConnection);

// Register global error handler
import { errorHandler } from './middleware/error.middleware';
fastify.setErrorHandler(errorHandler);

// Register request ID middleware to add X-Request-Id header to all responses
import { requestIdMiddleware } from './middleware/request-id.middleware';
fastify.addHook('onRequest', requestIdMiddleware);

// Auth hook
fastify.addHook('onRequest', async (request, _reply) => {
  // Public routes that don't require authentication (without version prefix)
  const publicRoutes = [
    '/health',
    '/metrics',
    '/metrics/json',
    '/webhooks/github',
    '/auth/github',
    '/auth/refresh',
    '/auth/logout',
  ];

  // Get the URL without query parameters
  const fullUrl = request.url.split('?')[0];

  // Check if it's a public route (unversioned)
  if (publicRoutes.includes(fullUrl)) {
    return;
  }

  // Check if it's a versioned public route (e.g., /api/v1/auth/refresh)
  // We need to check if the URL starts with /api/v1 and then matches a public route
  if (fullUrl.startsWith('/api/v1/')) {
    const pathWithoutVersion = fullUrl.substring(7); // Remove '/api/v1' prefix
    if (publicRoutes.includes(pathWithoutVersion)) {
      return;
    }
  }

  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError('Authentication required');
  }
});

fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Register metrics routes (unversioned - monitoring endpoints)
import { metricsRoutes } from './routes/metrics.routes';
fastify.register(metricsRoutes);

// Register API v1 routes under /api/v1 prefix
import { v1Routes } from './routes/v1';
fastify.register(v1Routes, { prefix: '/api/v1' });

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
