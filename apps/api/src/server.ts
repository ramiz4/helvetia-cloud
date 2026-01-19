import { initEnv } from './config/env.js';
import './load-env.js';

// Initialize environment variables
initEnv();

import './types/fastify.js';

import fastifyCookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

import { Queue } from 'bullmq';
import crypto from 'crypto';
import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { logger, loggerOptions } from 'shared';
import { BODY_LIMIT_GLOBAL, LOG_REQUESTS, LOG_RESPONSES } from './config/constants.js';
import { initializeContainer, registerInstance } from './di/index.js';
import { TOKENS } from './di/tokens.js';
import { UnauthorizedError } from './errors/index.js';
import { metricsService } from './services/metrics.service.js';
import { isOriginAllowed } from './utils/helpers/cors.helper.js';

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;

initializeContainer();

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

// Register Redis connection in DI if not already registered (useful for testing)
try {
  registerInstance(TOKENS.Redis, redisConnection);
} catch {
  // Already registered
}

// Set up deployment queue
const deploymentQueue = new Queue('deployments', {
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

registerInstance(TOKENS.DeploymentQueue, deploymentQueue);

/**
 * Fastify Application Instance
 *
 * Configured with:
 * - Structured logging via pino (shared logger)
 * - Raw body parsing for webhook verification
 * - Request ID generation for tracing
 * - AJV schema validator with OpenAPI keywords support
 */
/**
 * Create and configure a Fastify server instance
 */
export async function createServer() {
  const app = Fastify({
    logger: isTestEnv ? false : loggerOptions,
    bodyLimit: BODY_LIMIT_GLOBAL,
    genReqId: (req) => {
      return (req.headers['x-request-id'] as string) || crypto.randomUUID();
    },
    disableRequestLogging: !LOG_REQUESTS && !LOG_RESPONSES,
    ajv: {
      customOptions: {
        strict: false,
        keywords: ['example'],
      },
    },
    schemaController: {
      compilersFactory: {
        buildSerializer: () => () => JSON.stringify,
      },
    },
  });

  // Store redis connection on fastify instance for route access
  app.redis = redisConnection;

  // Register plugins
  if (LOG_REQUESTS || LOG_RESPONSES) {
    app.addHook('onResponse', async (request, reply) => {
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

  app.addHook('onRequest', async (request, _reply) => {
    const route = request.routeOptions?.url || request.url;
    request.metricsEndTimer = metricsService.startHttpRequest(request.method, route);
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url || request.url;
    const endTimer = request.metricsEndTimer;

    if (endTimer) {
      const duration = endTimer();
      metricsService.recordHttpRequest(request.method, route, reply.statusCode, duration);
    }
  });

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (isOriginAllowed(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.register(fastifyCookie);
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret',
    cookie: {
      cookieName: 'token',
      signed: false,
    },
    sign: {
      expiresIn: '15m',
    },
  });

  app.register(rateLimit, {
    max: isTestEnv ? 10000 : parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    redis: redisConnection,
    nameSpace: 'helvetia-rate-limit:',
    skipOnError: true,
    allowList: ['/health'],
    keyGenerator: (request) => {
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

  if (!isTestEnv) {
    import('./config/swagger.js')
      .then(({ swaggerConfig, swaggerUiConfig }) => {
        app.register(fastifySwagger, swaggerConfig);
        app.register(fastifySwaggerUi, swaggerUiConfig);
      })
      .catch((error) => {
        logger.error({ err: error }, 'Failed to register Swagger plugins');
      });
  }

  const { errorHandler } = await import('./middleware/error.middleware.js');
  app.setErrorHandler(errorHandler);

  const { requestIdMiddleware } = await import('./middleware/request-id.middleware.js');
  app.addHook('onRequest', requestIdMiddleware);

  app.addHook('onRequest', async (request, _reply) => {
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
      '/api/v1/docs',
      '/api/v1/docs/json',
      '/api/v1/docs/yaml',
      '/terms/latest',
      '/terms/version',
      '/terms/versions',
      '/privacy-policy/latest',
      '/privacy-policy/version',
      '/privacy-policy/versions',
      '/webhooks/stripe',
    ];

    const fullUrl = request.url.split('?')[0];

    if (publicRoutes.includes(fullUrl)) {
      return;
    }

    if (fullUrl.startsWith('/api/v1/docs/') || fullUrl.startsWith('/api/v1/docs/static/')) {
      return;
    }

    if (fullUrl.startsWith('/api/v1/')) {
      const pathWithoutVersion = fullUrl.substring(7);
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

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  const { metricsRoutes } = await import('./routes/metrics.routes.js');
  app.register(metricsRoutes);

  const { v1Routes } = await import('./routes/v1/index.js');
  app.register(v1Routes, { prefix: '/api/v1' });

  return app;
}

// Use a promise to ensure singleton initialization is thread-safe/race-condition free
let serverPromise: Promise<Awaited<ReturnType<typeof createServer>>> | null = null;

/**
 * Build or get the Fastify server instance
 * In production, this provides a singleton instance.
 * In test environment, call resetServerForTesting() between test files to avoid state pollution.
 */
export async function buildServer() {
  if (!serverPromise) {
    serverPromise = createServer();
  }
  return serverPromise;
}

/**
 * Reset the server singleton for testing purposes
 * MUST be called in afterAll/afterEach hooks to prevent test pollution
 *
 * @example
 * ```typescript
 * afterAll(async () => {
 *   await app.close();
 *   resetServerForTesting();
 * });
 * ```
 */
export function resetServerForTesting(): void {
  if (!isTestEnv) {
    throw new Error('resetServerForTesting() can only be called in test environment');
  }
  serverPromise = null;
}

// Re-export common helpers and constants used by tests for compatibility
export { BODY_LIMIT_GLOBAL, BODY_LIMIT_SMALL, BODY_LIMIT_STANDARD } from './config/constants.js';
export { getAllowedOrigins, getSafeOrigin, isOriginAllowed } from './utils/helpers/cors.helper.js';
