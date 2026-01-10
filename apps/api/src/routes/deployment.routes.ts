import type { FastifyPluginAsync } from 'fastify';
import { createRateLimitConfigs } from '../config/rateLimit';
import { DeploymentController } from '../controllers/DeploymentController';
import { resolve } from '../di';

/**
 * Deployment routes plugin
 * Handles all deployment-related endpoints
 */
export const deploymentRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<DeploymentController>(Symbol.for('DeploymentController'));

  // Get rate limit config
  const redis = (fastify as any).redis;
  const { wsRateLimitConfig } = createRateLimitConfigs(redis);

  /**
   * POST /services/:id/deploy
   * Trigger a new deployment for a service
   */
  fastify.post(
    '/services/:id/deploy',
    {
      config: { rateLimit: wsRateLimitConfig },
    },
    async (request, reply) => {
      return controller.deployService(request, reply);
    },
  );

  /**
   * POST /services/:id/restart
   * Restart a service container without rebuilding
   */
  fastify.post('/services/:id/restart', async (request, reply) => {
    return controller.restartService(request, reply);
  });

  /**
   * GET /services/:id/deployments
   * Get all deployments for a service
   */
  fastify.get('/services/:id/deployments', async (request, reply) => {
    return controller.getServiceDeployments(request, reply);
  });

  /**
   * GET /deployments/:id/logs
   * Get logs for a specific deployment
   */
  fastify.get('/deployments/:id/logs', async (request, reply) => {
    return controller.getDeploymentLogs(request, reply);
  });

  /**
   * GET /deployments/:id/logs/stream
   * SSE endpoint for real-time deployment logs
   */
  fastify.get(
    '/deployments/:id/logs/stream',
    {
      config: { rateLimit: wsRateLimitConfig },
    },
    async (request, reply) => {
      return controller.streamDeploymentLogs(request, reply);
    },
  );
};
