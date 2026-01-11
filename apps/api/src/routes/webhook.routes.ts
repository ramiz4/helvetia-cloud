import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_STANDARD } from '../config/constants';
import { createRateLimitConfigs } from '../config/rateLimit';
import { WebhookController } from '../controllers/WebhookController';
import { resolve, TOKENS } from '../di';

/**
 * Webhook routes plugin
 * Handles GitHub webhook endpoints with raw body parsing for signature verification
 */
export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<WebhookController>(TOKENS.WebhookController);

  // Get rate limit config
  const redis = fastify.redis;
  const { authRateLimitConfig } = createRateLimitConfigs(redis);

  /**
   * Webhook scope to capture raw body for signature verification
   * This is necessary because GitHub signs the raw request body,
   * and we need to verify the signature before parsing the JSON
   */
  await fastify.register(async (scope) => {
    // Custom content type parser that preserves raw body
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      req.rawBody = body;
      try {
        const bodyString = body.toString();
        if (!bodyString) {
          return done(null, {});
        }
        const json = JSON.parse(bodyString);
        done(null, json);
      } catch (err: unknown) {
        const error = err as Error;
        // Pass the error to the handler via a special flag
        done(null, { _isMalformed: true, _error: error.message });
      }
    });

    /**
     * POST /webhooks/github
     * GitHub webhook endpoint for Push and Pull Request events
     */
    scope.post(
      '/webhooks/github',
      {
        config: { rateLimit: authRateLimitConfig },
        bodyLimit: BODY_LIMIT_STANDARD, // 1MB limit for webhook payloads
      },
      async (request, reply) => {
        return controller.handleGitHubWebhook(request, reply);
      },
    );
  });
};
