import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolve } from '../di';
import type { FeatureFlagService } from '../services';

/**
 * Schema for creating a feature flag
 */
const createFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/i, {
      message: 'Key must contain only letters, numbers, underscores, and hyphens',
    }),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional().default(false),
  segments: z
    .object({
      type: z.enum(['userIds', 'percentage']).optional(),
      userIds: z.array(z.string()).optional(),
      percentage: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

/**
 * Schema for updating a feature flag
 */
const updateFlagSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
  segments: z
    .object({
      type: z.enum(['userIds', 'percentage']).optional(),
      userIds: z.array(z.string()).optional(),
      percentage: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

/**
 * Schema for checking feature flag status
 */
const checkFlagSchema = z.object({
  key: z.string().min(1),
  userId: z.string().optional(),
});

/**
 * Feature flag routes
 */
export const featureFlagRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Get all feature flags
   */
  fastify.get(
    '/feature-flags',
    {
      preHandler: [fastify.authenticate],
    },
    async (_request, reply) => {
      try {
        const featureFlagService = resolve<FeatureFlagService>(Symbol.for('FeatureFlagService'));
        const flags = await featureFlagService.getAllFlags();
        return reply.send({ success: true, data: flags });
      } catch (error) {
        fastify.log.error(error, 'Failed to get feature flags');
        return reply.code(500).send({ success: false, error: 'Failed to get feature flags' });
      }
    },
  );

  /**
   * Get a feature flag by ID
   */
  fastify.get<{
    Params: { id: string };
  }>(
    '/feature-flags/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const featureFlagService = resolve<FeatureFlagService>(Symbol.for('FeatureFlagService'));
        const flag = await featureFlagService.getFlagById(request.params.id);

        if (!flag) {
          return reply.code(404).send({ success: false, error: 'Feature flag not found' });
        }

        return reply.send({ success: true, data: flag });
      } catch (error) {
        fastify.log.error(error, 'Failed to get feature flag');
        return reply.code(500).send({ success: false, error: 'Failed to get feature flag' });
      }
    },
  );

  /**
   * Create a new feature flag
   */
  fastify.post(
    '/feature-flags',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const parseResult = createFlagSchema.safeParse(request.body);

        if (!parseResult.success) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid request data',
            details: parseResult.error.flatten(),
          });
        }

        const featureFlagService = resolve<FeatureFlagService>(Symbol.for('FeatureFlagService'));
        const flag = await featureFlagService.createFlag(parseResult.data);

        return reply.code(201).send({ success: true, data: flag });
      } catch (error) {
        fastify.log.error(error, 'Failed to create feature flag');
        if (error instanceof Error && error.message.includes('already exists')) {
          return reply.code(409).send({ success: false, error: error.message });
        }
        return reply.code(500).send({ success: false, error: 'Failed to create feature flag' });
      }
    },
  );

  /**
   * Update a feature flag
   */
  fastify.patch<{
    Params: { id: string };
  }>(
    '/feature-flags/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const parseResult = updateFlagSchema.safeParse(request.body);

        if (!parseResult.success) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid request data',
            details: parseResult.error.flatten(),
          });
        }

        const featureFlagService = resolve<FeatureFlagService>(Symbol.for('FeatureFlagService'));
        const flag = await featureFlagService.updateFlag(request.params.id, parseResult.data);

        return reply.send({ success: true, data: flag });
      } catch (error) {
        fastify.log.error(error, 'Failed to update feature flag');
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({ success: false, error: error.message });
        }
        return reply.code(500).send({ success: false, error: 'Failed to update feature flag' });
      }
    },
  );

  /**
   * Toggle a feature flag on/off
   */
  fastify.post<{
    Params: { id: string };
  }>(
    '/feature-flags/:id/toggle',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const featureFlagService = resolve<FeatureFlagService>(Symbol.for('FeatureFlagService'));
        const flag = await featureFlagService.toggleFlag(request.params.id);

        return reply.send({ success: true, data: flag });
      } catch (error) {
        fastify.log.error(error, 'Failed to toggle feature flag');
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({ success: false, error: error.message });
        }
        return reply.code(500).send({ success: false, error: 'Failed to toggle feature flag' });
      }
    },
  );

  /**
   * Delete a feature flag
   */
  fastify.delete<{
    Params: { id: string };
  }>(
    '/feature-flags/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const featureFlagService = resolve<FeatureFlagService>(Symbol.for('FeatureFlagService'));
        await featureFlagService.deleteFlag(request.params.id);

        return reply.send({ success: true, message: 'Feature flag deleted successfully' });
      } catch (error) {
        fastify.log.error(error, 'Failed to delete feature flag');
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({ success: false, error: error.message });
        }
        return reply.code(500).send({ success: false, error: 'Failed to delete feature flag' });
      }
    },
  );

  /**
   * Check if a feature flag is enabled
   * Public endpoint (no authentication required)
   */
  fastify.post('/feature-flags/check', async (request, reply) => {
    try {
      const parseResult = checkFlagSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid request data',
          details: parseResult.error.flatten(),
        });
      }

      const featureFlagService = resolve<FeatureFlagService>(Symbol.for('FeatureFlagService'));
      const enabled = await featureFlagService.isEnabled(
        parseResult.data.key,
        parseResult.data.userId,
      );

      return reply.send({ success: true, enabled });
    } catch (error) {
      fastify.log.error(error, 'Failed to check feature flag');
      return reply.code(500).send({ success: false, error: 'Failed to check feature flag' });
    }
  });
};
