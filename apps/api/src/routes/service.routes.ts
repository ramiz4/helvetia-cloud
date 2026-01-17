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
  const redis = fastify.redis;
  const { wsRateLimitConfig } = createRateLimitConfigs(redis);

  /**
   * GET /services
   * List all services for the authenticated user
   */
  fastify.get(
    '/services',
    {
      schema: {
        tags: ['Services'],
        summary: 'List all services',
        description: 'Retrieve all services for the authenticated user.',
        response: {
          200: {
            description: 'List of services',
            type: 'array',
            items: {
              type: 'object',
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
        },
      },
    },
    async (request, _reply) => {
      return controller.getAllServices(request);
    },
  );

  /**
   * GET /services/:id
   * Get a specific service by ID
   */
  fastify.get(
    '/services/:id',
    {
      schema: {
        tags: ['Services'],
        summary: 'Get service by ID',
        description: 'Retrieve a specific service by its ID.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID (UUID format)',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service details',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          403: {
            description: 'Forbidden - service belongs to another user',
            type: 'object',
          },
          404: {
            description: 'Service not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getServiceById(request, reply);
    },
  );

  /**
   * POST /services
   * Create a new service
   */
  fastify.post(
    '/services',
    {
      bodyLimit: BODY_LIMIT_SMALL, // 100KB limit for service creation
      schema: {
        tags: ['Services'],
        summary: 'Create a new service',
        description:
          'Create a new service with the specified configuration. Requires name field. See documentation for all available fields and validation rules.',
        response: {
          201: {
            description: 'Service created successfully',
            type: 'object',
          },
          400: {
            description: 'Bad request - validation error',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          409: {
            description: 'Conflict - service name already exists',
            type: 'object',
          },
        },
      },
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
      schema: {
        tags: ['Services'],
        summary: 'Update a service',
        description:
          'Update service configuration. All fields are optional. See documentation for validation rules.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID (UUID format)',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service updated successfully',
            type: 'object',
          },
          400: {
            description: 'Bad request - validation error',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          403: {
            description: 'Forbidden',
            type: 'object',
          },
          404: {
            description: 'Service not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.updateService(request, reply);
    },
  );

  /**
   * DELETE /services/:id
   * Soft delete a service
   */
  fastify.delete(
    '/services/:id',
    {
      schema: {
        tags: ['Services'],
        summary: 'Delete a service',
        description: 'Soft delete a service (can be recovered later).',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID (UUID format)',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service deleted successfully',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Service deleted successfully',
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          403: {
            description: 'Forbidden - service is protected',
            type: 'object',
          },
          404: {
            description: 'Service not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.deleteService(request, reply);
    },
  );

  /**
   * POST /services/:id/recover
   * Recover a soft-deleted service
   */
  fastify.post(
    '/services/:id/recover',
    {
      schema: {
        tags: ['Services'],
        summary: 'Recover a deleted service',
        description: 'Restore a soft-deleted service.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID (UUID format)',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service recovered successfully',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Service not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.recoverService(request, reply);
    },
  );

  /**
   * PATCH /services/:id/protection
   * Toggle delete protection for a service
   */
  fastify.patch(
    '/services/:id/protection',
    {
      schema: {
        tags: ['Services'],
        summary: 'Toggle delete protection',
        description:
          'Enable or disable delete protection for a service. Requires deleteProtected field (boolean).',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID (UUID format)',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Protection updated successfully',
            type: 'object',
          },
          400: {
            description: 'Bad request',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Service not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.toggleProtection(request, reply);
    },
  );

  /**
   * GET /services/:id/health
   * Get health status of a service
   */
  fastify.get(
    '/services/:id/health',
    {
      schema: {
        tags: ['Services'],
        summary: 'Get service health',
        description: 'Check the health status of a running service.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID (UUID format)',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Health status',
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'unhealthy', 'unknown'],
                example: 'healthy',
              },
              uptime: {
                type: 'number',
                description: 'Service uptime in seconds',
                example: 3600,
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Service not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getServiceHealth(request, reply);
    },
  );

  /**
   * GET /services/:id/metrics
   * Get metrics for a specific service
   */
  fastify.get(
    '/services/:id/metrics',
    {
      schema: {
        tags: ['Services'],
        summary: 'Get service metrics',
        description: 'Retrieve CPU and memory metrics for a service.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID (UUID format)',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service metrics',
            type: 'object',
            properties: {
              cpu: {
                type: 'number',
                description: 'CPU usage percentage',
                example: 45.2,
              },
              memory: {
                type: 'number',
                description: 'Memory usage in bytes',
                example: 536870912,
              },
              memoryLimit: {
                type: 'number',
                description: 'Memory limit in bytes',
                example: 1073741824,
              },
              memoryPercent: {
                type: 'number',
                description: 'Memory usage percentage',
                example: 50.0,
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Service not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getServiceMetrics(request, reply);
    },
  );

  /**
   * GET /services/metrics/stream
   * SSE endpoint for real-time metrics streaming
   */
  fastify.get(
    '/services/metrics/stream',
    {
      config: { rateLimit: wsRateLimitConfig },
      schema: {
        tags: ['Services'],
        summary: 'Stream service metrics (SSE)',
        description: 'Server-Sent Events endpoint for real-time service metrics updates.',
        response: {
          200: {
            description: 'SSE stream of service metrics',
            type: 'string',
            contentMediaType: 'text/event-stream',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.streamMetrics(request, reply);
    },
  );
};
