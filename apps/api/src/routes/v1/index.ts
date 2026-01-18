import type { FastifyPluginAsync } from 'fastify';

/**
 * API v1 Routes
 *
 * This plugin registers all v1 API routes under the /api/v1 prefix.
 *
 * Version 1 includes all current API endpoints:
 * - Authentication & Authorization
 * - Service Management
 * - Deployment Operations
 * - Project Management
 * - GitHub Integration
 * - Webhooks
 *
 * Version Negotiation:
 * - Clients should use the /api/v1 prefix for all requests
 * - Legacy clients without version prefix must be updated to use /api/v1 (unversioned routes return 404)
 * - Future versions (v2, v3) will be registered in parallel
 *
 * Breaking Changes Policy:
 * - v1 endpoints maintain backward compatibility
 * - Breaking changes require a new version (v2)
 * - Deprecated endpoints are marked in documentation
 * - Old versions are supported for at least 6 months after new version release
 */
export const v1Routes: FastifyPluginAsync = async (fastify) => {
  // Import route modules dynamically to avoid circular dependencies
  const { authRoutes } = await import('../auth.routes.js');
  const { billingRoutes } = await import('../billing.routes.js');
  const { serviceRoutes } = await import('../service.routes.js');
  const { deploymentRoutes } = await import('../deployment.routes.js');
  const { featureFlagRoutes } = await import('../feature-flag.routes.js');
  const { gdprRoutes } = await import('../gdpr.routes.js');
  const { githubRoutes } = await import('../github.routes.js');
  const { projectRoutes } = await import('../project.routes.js');
  const { webhookRoutes } = await import('../webhook.routes.js');
  const { stripeWebhookRoutes } = await import('../stripe-webhook.routes.js');
  const { organizationRoutes } = await import('../organization.routes.js');
  const { termsRoutes } = await import('../terms.routes.js');

  // Register all v1 routes
  fastify.register(authRoutes);
  fastify.register(billingRoutes);
  fastify.register(serviceRoutes);
  fastify.register(deploymentRoutes);
  fastify.register(featureFlagRoutes);
  fastify.register(gdprRoutes);
  fastify.register(githubRoutes);
  fastify.register(projectRoutes);
  fastify.register(webhookRoutes);
  fastify.register(stripeWebhookRoutes);
  fastify.register(organizationRoutes);
  fastify.register(termsRoutes);
};
