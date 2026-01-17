import type { FastifyPluginAsync } from 'fastify';
import { createRateLimitConfigs } from '../config/rateLimit';
import { DeploymentController } from '../controllers/DeploymentController';
import { resolve, TOKENS } from '../di';

/**
 * Deployment routes plugin
 * Handles all deployment-related endpoints
 */
export const deploymentRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<DeploymentController>(TOKENS.DeploymentController);

  // Get rate limit config
  const redis = fastify.redis;
  const { wsRateLimitConfig, deploymentRateLimitConfig } = createRateLimitConfigs(redis);

  /**
   * POST /services/:id/deploy
   * Trigger a new deployment for a service
   */
  fastify.post(
    '/services/:id/deploy',
    {
      config: { rateLimit: deploymentRateLimitConfig },
      schema: {
        tags: ['Deployments'],
        summary: 'Deploy a service',
        description: 'Trigger a new deployment for a service. Queues a build and deployment job.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID',
            },
          },
        },
        response: {
          201: {
            description: 'Deployment started',
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
      return controller.deployService(request, reply);
    },
  );

  /**
   * POST /services/:id/restart
   * Restart a service container without rebuilding
   */
  fastify.post(
    '/services/:id/restart',
    {
      config: { rateLimit: deploymentRateLimitConfig },
      schema: {
        tags: ['Deployments'],
        summary: 'Restart a service',
        description: 'Restart a service container without rebuilding the image.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service restarted',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Service restarted successfully',
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
      return controller.restartService(request, reply);
    },
  );

  /**
   * POST /services/:id/stop
   * Stop a running service container
   */
  fastify.post(
    '/services/:id/stop',
    {
      schema: {
        tags: ['Deployments'],
        summary: 'Stop a service',
        description: 'Stop a running service container.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID',
            },
          },
        },
        response: {
          200: {
            description: 'Service stopped',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Service stopped successfully',
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
      return controller.stopService(request, reply);
    },
  );

  /**
   * GET /services/:id/deployments
   * Get all deployments for a service
   */
  fastify.get(
    '/services/:id/deployments',
    {
      schema: {
        tags: ['Deployments'],
        summary: 'List service deployments',
        description: 'Get all deployments for a specific service.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Service ID',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Number of deployments to return',
            },
            offset: {
              type: 'integer',
              minimum: 0,
              default: 0,
              description: 'Number of deployments to skip',
            },
          },
        },
        response: {
          200: {
            description: 'List of deployments',
            type: 'array',
            items: {
              type: 'object',
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
      return controller.getServiceDeployments(request, reply);
    },
  );

  /**
   * GET /deployments/:id/logs
   * Get logs for a specific deployment
   */
  fastify.get(
    '/deployments/:id/logs',
    {
      schema: {
        tags: ['Deployments'],
        summary: 'Get deployment logs',
        description: 'Retrieve logs for a specific deployment.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Deployment ID',
            },
          },
        },
        response: {
          200: {
            description: 'Deployment logs',
            type: 'object',
            properties: {
              logs: {
                type: 'string',
                description: 'Deployment logs',
                example: 'Building...\nDeployment successful',
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Deployment not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getDeploymentLogs(request, reply);
    },
  );

  /**
   * GET /deployments/:id/logs/stream
   * SSE endpoint for real-time deployment logs
   */
  fastify.get(
    '/deployments/:id/logs/stream',
    {
      config: { rateLimit: wsRateLimitConfig },
      schema: {
        tags: ['Deployments'],
        summary: 'Stream deployment logs (SSE)',
        description: 'Server-Sent Events endpoint for real-time deployment logs.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Deployment ID',
            },
          },
        },
        response: {
          200: {
            description: 'SSE stream of deployment logs',
            type: 'string',
            contentMediaType: 'text/event-stream',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Deployment not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.streamDeploymentLogs(request, reply);
    },
  );
};
