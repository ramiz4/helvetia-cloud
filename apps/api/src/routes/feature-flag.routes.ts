import type { FastifyPluginAsync } from 'fastify';
import { createRateLimitConfigs } from '../config/rateLimit.js';
import { FeatureFlagController } from '../controllers/FeatureFlagController.js';
import { resolve, TOKENS } from '../di/index.js';
import { requireAdmin } from '../middleware/auth.middleware.js';

/**
 * Feature flag routes
 */
export const featureFlagRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<FeatureFlagController>(TOKENS.FeatureFlagController);

  // Setup rate limiting for public check endpoint
  const redis = fastify.redis;
  const { featureFlagCheckRateLimitConfig } = createRateLimitConfigs(redis);

  /**
   * Get all feature flags
   */
  fastify.get(
    '/feature-flags',
    {
      preHandler: requireAdmin,
      schema: {
        tags: ['Feature Flags'],
        summary: 'List all feature flags',
        description: 'Retrieve all feature flags (admin only).',
        response: {
          200: {
            description: 'List of feature flags',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    key: { type: 'string', example: 'new-ui' },
                    name: { type: 'string', example: 'New User Interface' },
                    enabled: { type: 'boolean', example: true },
                    description: {
                      type: 'string',
                      example: 'Enable new UI features',
                      nullable: true,
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          403: {
            description: 'Forbidden - admin access required',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getAllFlags(request, reply);
    },
  );

  /**
   * Get a feature flag by ID
   */
  fastify.get(
    '/feature-flags/:id',
    {
      preHandler: requireAdmin,
      schema: {
        tags: ['Feature Flags'],
        summary: 'Get feature flag by ID',
        description: 'Retrieve a specific feature flag (admin only).',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Feature flag ID',
            },
          },
        },
        response: {
          200: {
            description: 'Feature flag details',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  key: { type: 'string' },
                  name: { type: 'string' },
                  enabled: { type: 'boolean' },
                  description: { type: 'string', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
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
            description: 'Feature flag not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getFlagById(request, reply);
    },
  );

  /**
   * Create a new feature flag
   */
  fastify.post(
    '/feature-flags',
    {
      preHandler: requireAdmin,
      schema: {
        tags: ['Feature Flags'],
        summary: 'Create a feature flag',
        description: 'Create a new feature flag (admin only).',
        body: {
          type: 'object',
          required: ['key', 'name'],
          properties: {
            key: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Feature flag key (machine name)',
              example: 'new-ui',
            },
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              description: 'Feature flag display name',
              example: 'New User Interface',
            },
            enabled: {
              type: 'boolean',
              description: 'Initial enabled state',
              example: false,
              default: false,
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Feature flag description',
              example: 'Enable new UI features',
            },
          },
        },
        response: {
          201: {
            description: 'Feature flag created',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  key: { type: 'string' },
                  name: { type: 'string' },
                  enabled: { type: 'boolean' },
                  description: { type: 'string', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          400: {
            description: 'Bad request',
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
          409: {
            description: 'Conflict - feature flag already exists',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.createFlag(request, reply);
    },
  );

  /**
   * Update an existing feature flag
   */
  fastify.patch(
    '/feature-flags/:id',
    {
      preHandler: requireAdmin,
      schema: {
        tags: ['Feature Flags'],
        summary: 'Update a feature flag',
        description: 'Update feature flag properties (admin only).',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Feature flag ID',
            },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Feature flag name',
            },
            enabled: {
              type: 'boolean',
              description: 'Enabled state',
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Feature flag description',
            },
          },
        },
        response: {
          200: {
            description: 'Feature flag updated',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  key: { type: 'string' },
                  name: { type: 'string' },
                  enabled: { type: 'boolean' },
                  description: { type: 'string', nullable: true },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          400: {
            description: 'Bad request',
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
            description: 'Feature flag not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.updateFlag(request, reply);
    },
  );

  /**
   * Toggle a feature flag on/off
   */
  fastify.post(
    '/feature-flags/:id/toggle',
    {
      preHandler: requireAdmin,
      schema: {
        tags: ['Feature Flags'],
        summary: 'Toggle feature flag',
        description: 'Toggle a feature flag on/off (admin only).',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Feature flag ID',
            },
          },
        },
        response: {
          200: {
            description: 'Feature flag toggled',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  enabled: { type: 'boolean', description: 'New enabled state' },
                },
              },
            },
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
            description: 'Feature flag not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.toggleFlag(request, reply);
    },
  );

  /**
   * Delete a feature flag
   */
  fastify.delete(
    '/feature-flags/:id',
    {
      preHandler: requireAdmin,
      schema: {
        tags: ['Feature Flags'],
        summary: 'Delete feature flag',
        description: 'Delete a feature flag (admin only).',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Feature flag ID',
            },
          },
        },
        response: {
          200: {
            description: 'Feature flag deleted',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Feature flag deleted successfully',
              },
            },
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
            description: 'Feature flag not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.deleteFlag(request, reply);
    },
  );

  /**
   * Check if a feature flag is enabled
   * Public endpoint, but rate limited
   */
  fastify.post(
    '/feature-flags/check',
    {
      config: { rateLimit: featureFlagCheckRateLimitConfig },
      schema: {
        tags: ['Feature Flags'],
        summary: 'Check feature flag',
        description: 'Check if a feature flag is enabled. Public endpoint with rate limiting.',
        body: {
          type: 'object',
          required: ['key'],
          properties: {
            key: {
              type: 'string',
              description: 'Feature flag key to check',
              example: 'new-ui',
            },
            userId: {
              type: 'string',
              description: 'Optional user ID for A/B testing',
              example: 'user_123',
            },
          },
        },
        response: {
          200: {
            description: 'Feature flag status',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              enabled: {
                type: 'boolean',
                description: 'Whether the feature flag is enabled',
                example: true,
              },
            },
          },
          400: {
            description: 'Bad request',
            type: 'object',
          },
          404: {
            description: 'Feature flag not found',
            type: 'object',
          },
        },
        security: [], // Public endpoint
      },
    },
    async (request, reply) => {
      return controller.checkFlag(request, reply);
    },
  );

  /**
   * Check multiple feature flags at once (bulk check)
   * Public endpoint, but rate limited
   */
  fastify.post(
    '/feature-flags/check-bulk',
    {
      config: { rateLimit: featureFlagCheckRateLimitConfig },
      schema: {
        tags: ['Feature Flags'],
        summary: 'Check multiple feature flags',
        description:
          'Check the status of multiple feature flags at once. Public endpoint with rate limiting.',
        body: {
          type: 'object',
          required: ['keys'],
          properties: {
            keys: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of feature flag keys to check',
              example: ['new-ui', 'dark-mode', 'beta-features'],
            },
            userId: {
              type: 'string',
              description: 'Optional user ID for A/B testing',
              example: 'user_123',
            },
          },
        },
        response: {
          200: {
            description: 'Feature flags status',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                additionalProperties: {
                  type: 'boolean',
                },
                example: {
                  'new-ui': true,
                  'dark-mode': false,
                  'beta-features': true,
                },
              },
            },
          },
          400: {
            description: 'Bad request',
            type: 'object',
          },
        },
        security: [], // Public endpoint
      },
    },
    async (request, reply) => {
      return controller.checkBulkFlags(request, reply);
    },
  );
};
