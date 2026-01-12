import type { FastifyPluginAsync } from 'fastify';
import { createRateLimitConfigs } from '../config/rateLimit';
import { FeatureFlagController } from '../controllers/FeatureFlagController';
import { resolve, TOKENS } from '../di';

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
  fastify.get('/feature-flags', async (request, reply) => {
    return controller.getAllFlags(request, reply);
  });

  /**
   * Get a feature flag by ID
   */
  fastify.get('/feature-flags/:id', async (request, reply) => {
    return controller.getFlagById(request, reply);
  });

  /**
   * Create a new feature flag
   */
  fastify.post('/feature-flags', async (request, reply) => {
    return controller.createFlag(request, reply);
  });

  /**
   * Update an existing feature flag
   */
  fastify.patch('/feature-flags/:id', async (request, reply) => {
    return controller.updateFlag(request, reply);
  });

  /**
   * Toggle a feature flag on/off
   */
  fastify.post('/feature-flags/:id/toggle', async (request, reply) => {
    return controller.toggleFlag(request, reply);
  });

  /**
   * Delete a feature flag
   */
  fastify.delete('/feature-flags/:id', async (request, reply) => {
    return controller.deleteFlag(request, reply);
  });

  /**
   * Check if a feature flag is enabled
   * Public endpoint, but rate limited
   */
  fastify.post(
    '/feature-flags/check',
    {
      config: { rateLimit: featureFlagCheckRateLimitConfig },
    },
    async (request, reply) => {
      return controller.checkFlag(request, reply);
    },
  );
};
