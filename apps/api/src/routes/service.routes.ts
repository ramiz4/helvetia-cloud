import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_SMALL } from '../config/constants';
import { createRateLimitConfigs } from '../config/rateLimit';
import { ServiceController } from '../controllers/ServiceController';
import { resolve, TOKENS } from '../di';

/**
 * Service routes plugin
 * Handles all service-related endpoints
 */
export const serviceRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<ServiceController>(TOKENS.ServiceController);

  // Get rate limit config
  const redis = (fastify as any).redis;
  const { wsRateLimitConfig } = createRateLimitConfigs(redis);

  /**
   * GET /services
   * List all services for the authenticated user
   */
  fastify.get('/services', async (request, reply) => {
    return controller.getAllServices(request);
  });

  /**
   * GET /services/:id
   * Get a specific service by ID
   */
  fastify.get('/services/:id', async (request, reply) => {
    return controller.getServiceById(request, reply);
  });

  /**
   * POST /services
   * Create a new service
   */
  fastify.post(
    '/services',
    {
      bodyLimit: BODY_LIMIT_SMALL, // 100KB limit for service creation
    },
    async (request, reply) => {
      return controller.createService(request, reply);
    },
  );

  /**
   * PATCH /services/:id
   * Update an existing service
   */
  fastify.patch(
    '/services/:id',
    {
      bodyLimit: BODY_LIMIT_SMALL, // 100KB limit for service updates
    },
    async (request, reply) => {
      return controller.updateService(request, reply);
    },
  );

  /**
   * DELETE /services/:id
   * Soft delete a service
   */
  fastify.delete('/services/:id', async (request, reply) => {
    return controller.deleteService(request, reply);
  });

  /**
   * POST /services/:id/recover
   * Recover a soft-deleted service
   */
  fastify.post('/services/:id/recover', async (request, reply) => {
    return controller.recoverService(request, reply);
  });

  /**
   * PATCH /services/:id/protection
   * Toggle delete protection for a service
   */
  fastify.patch('/services/:id/protection', async (request, reply) => {
    return controller.toggleProtection(request, reply);
  });

  /**
   * GET /services/:id/health
   * Get health status of a service
   */
  fastify.get('/services/:id/health', async (request, reply) => {
    return controller.getServiceHealth(request, reply);
  });

  /**
   * GET /services/:id/metrics
   * Get metrics for a specific service
   */
  fastify.get('/services/:id/metrics', async (request, reply) => {
    return controller.getServiceMetrics(request, reply);
  });

  /**
   * GET /services/metrics/stream
   * SSE endpoint for real-time metrics streaming
   */
  fastify.get(
    '/services/metrics/stream',
    {
      config: { rateLimit: wsRateLimitConfig },
    },
    async (request, reply) => {
      return controller.streamMetrics(request, reply);
    },
  );
};
