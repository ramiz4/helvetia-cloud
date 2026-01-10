import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_SMALL } from '../config/constants';
import { resolve, TOKENS } from '../di';
import { ServiceController } from '../controllers/ServiceController';

/**
 * Service routes plugin
 * Handles all service-related endpoints
 */
export const serviceRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<ServiceController>(Symbol.for('ServiceController'));

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
  fastify.get('/services/metrics/stream', async (request, reply) => {
    return controller.streamMetrics(request, reply);
  });
};
