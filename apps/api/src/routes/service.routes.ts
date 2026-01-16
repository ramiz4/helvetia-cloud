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
              $ref: '#/components/schemas/Service',
            },
          },
          401: {
            description: 'Unauthorized',
            $ref: '#/components/schemas/Error',
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
              format: 'uuid',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service details',
            $ref: '#/components/schemas/Service',
          },
          401: {
            description: 'Unauthorized',
            $ref: '#/components/schemas/Error',
          },
          403: {
            description: 'Forbidden - service belongs to another user',
            $ref: '#/components/schemas/Error',
          },
          404: {
            description: 'Service not found',
            $ref: '#/components/schemas/Error',
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
        description: 'Create a new service with the specified configuration.',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 63,
              pattern: '^[a-z0-9-]+$',
              description: 'Service name (lowercase alphanumeric with hyphens)',
              example: 'my-service',
            },
            type: {
              type: 'string',
              enum: ['DOCKER', 'STATIC', 'POSTGRES', 'REDIS', 'MYSQL', 'COMPOSE'],
              description: 'Service type',
              example: 'DOCKER',
            },
            repoUrl: {
              type: 'string',
              format: 'uri',
              description: 'GitHub repository URL',
              example: 'https://github.com/user/repo',
            },
            branch: {
              type: 'string',
              description: 'Git branch to deploy',
              example: 'main',
            },
            buildCommand: {
              type: 'string',
              maxLength: 1000,
              description: 'Build command',
              example: 'npm install && npm run build',
            },
            startCommand: {
              type: 'string',
              maxLength: 1000,
              description: 'Start command',
              example: 'npm start',
            },
            port: {
              type: 'integer',
              minimum: 1,
              maximum: 65535,
              description: 'Container port',
              example: 3000,
            },
            envVars: {
              type: 'object',
              additionalProperties: {
                type: 'string',
              },
              description: 'Environment variables',
              example: {
                NODE_ENV: 'production',
              },
            },
            customDomain: {
              type: 'string',
              maxLength: 255,
              description: 'Custom domain',
              example: 'myapp.com',
            },
            staticOutputDir: {
              type: 'string',
              maxLength: 255,
              description: 'Static site output directory',
              example: 'dist',
            },
            volumes: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Volume mounts',
              example: ['/data'],
            },
            environmentId: {
              type: 'string',
              format: 'uuid',
              description: 'Environment ID',
            },
          },
        },
        response: {
          201: {
            description: 'Service created successfully',
            $ref: '#/components/schemas/Service',
          },
          400: {
            description: 'Bad request - validation error',
            $ref: '#/components/schemas/Error',
          },
          401: {
            description: 'Unauthorized',
            $ref: '#/components/schemas/Error',
          },
          409: {
            description: 'Conflict - service name already exists',
            $ref: '#/components/schemas/Error',
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
        description: 'Update service configuration. All fields are optional.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Service ID',
            },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 63,
              pattern: '^[a-z0-9-]+$',
              description: 'Service name',
            },
            repoUrl: {
              type: 'string',
              format: 'uri',
              description: 'GitHub repository URL',
            },
            branch: {
              type: 'string',
              description: 'Git branch',
            },
            buildCommand: {
              type: 'string',
              maxLength: 1000,
              description: 'Build command',
            },
            startCommand: {
              type: 'string',
              maxLength: 1000,
              description: 'Start command',
            },
            port: {
              type: 'integer',
              minimum: 1,
              maximum: 65535,
              description: 'Container port',
            },
            envVars: {
              type: 'object',
              additionalProperties: {
                type: 'string',
              },
              description: 'Environment variables',
            },
            customDomain: {
              type: 'string',
              maxLength: 255,
              description: 'Custom domain',
            },
            type: {
              type: 'string',
              enum: ['DOCKER', 'STATIC', 'POSTGRES', 'REDIS', 'MYSQL', 'COMPOSE'],
              description: 'Service type',
            },
            staticOutputDir: {
              type: 'string',
              maxLength: 255,
              description: 'Static output directory',
            },
            volumes: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Volume mounts',
            },
            environmentId: {
              type: 'string',
              format: 'uuid',
              description: 'Environment ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service updated successfully',
            $ref: '#/components/schemas/Service',
          },
          400: {
            description: 'Bad request - validation error',
            $ref: '#/components/schemas/Error',
          },
          401: {
            description: 'Unauthorized',
            $ref: '#/components/schemas/Error',
          },
          403: {
            description: 'Forbidden',
            $ref: '#/components/schemas/Error',
          },
          404: {
            description: 'Service not found',
            $ref: '#/components/schemas/Error',
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
              format: 'uuid',
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
            $ref: '#/components/schemas/Error',
          },
          403: {
            description: 'Forbidden - service is protected',
            $ref: '#/components/schemas/Error',
          },
          404: {
            description: 'Service not found',
            $ref: '#/components/schemas/Error',
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
              format: 'uuid',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service recovered successfully',
            $ref: '#/components/schemas/Service',
          },
          401: {
            description: 'Unauthorized',
            $ref: '#/components/schemas/Error',
          },
          404: {
            description: 'Service not found',
            $ref: '#/components/schemas/Error',
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
        description: 'Enable or disable delete protection for a service.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Service ID',
            },
          },
        },
        body: {
          type: 'object',
          required: ['deleteProtected'],
          properties: {
            deleteProtected: {
              type: 'boolean',
              description: 'Enable/disable delete protection',
              example: true,
            },
          },
        },
        response: {
          200: {
            description: 'Protection updated successfully',
            $ref: '#/components/schemas/Service',
          },
          400: {
            description: 'Bad request',
            $ref: '#/components/schemas/Error',
          },
          401: {
            description: 'Unauthorized',
            $ref: '#/components/schemas/Error',
          },
          404: {
            description: 'Service not found',
            $ref: '#/components/schemas/Error',
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
              format: 'uuid',
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
            $ref: '#/components/schemas/Error',
          },
          404: {
            description: 'Service not found',
            $ref: '#/components/schemas/Error',
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
              format: 'uuid',
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
            $ref: '#/components/schemas/Error',
          },
          404: {
            description: 'Service not found',
            $ref: '#/components/schemas/Error',
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
            $ref: '#/components/schemas/Error',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.streamMetrics(request, reply);
    },
  );
};
