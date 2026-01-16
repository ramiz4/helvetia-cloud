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
import { logger } from 'shared';
import {
  BODY_LIMIT_GLOBAL,
  BODY_LIMIT_SMALL,
  BODY_LIMIT_STANDARD,
  LOG_REQUESTS,
  LOG_RESPONSES,
} from './config/constants';
import { initializeContainer, registerInstance } from './di';
import { UnauthorizedError } from './errors';
import { metricsService } from './services/metrics.service';
import { getAllowedOrigins, getSafeOrigin, isOriginAllowed } from './utils/helpers/cors.helper';

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;

// Initialize DI container
initializeContainer();

// Create Redis connection
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// Register Redis connection in DI if not already registered (useful for testing)
try {
  registerInstance(Symbol.for('RedisConnection'), redisConnection);
} catch {
  // Already registered
}

// Set up deployment queue
const deploymentQueue = new Queue('build', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

registerInstance(Symbol.for('IDeploymentQueue'), deploymentQueue);

/**
 * Fastify Application Instance
 *
 * Configured with:
 * - Structured logging via pino (shared logger)
 * - Raw body parsing for webhook verification
 * - Request ID generation for tracing
 */
export const fastify = Fastify({
  logger: isTestEnv ? false : logger,
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

// Register plugins
if (LOG_REQUESTS || LOG_RESPONSES) {
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
    '/auth/login',
    '/auth/refresh',
    '/auth/logout',
    '/feature-flags/check',
    '/feature-flags/check-bulk',
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
