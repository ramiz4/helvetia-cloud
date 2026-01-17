import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_STANDARD } from '../config/constants';
import { StripeWebhookController } from '../controllers/StripeWebhookController';
import { resolve, TOKENS } from '../di';

/**
 * Stripe webhook routes plugin
 * Handles Stripe webhook events
 * Note: This route does NOT use authentication middleware as webhooks come from Stripe
 */
export const stripeWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  const webhookController = resolve<StripeWebhookController>(TOKENS.StripeWebhookController);

  /**
   * Webhook scope to capture raw body for signature verification
   * This is necessary because Stripe signs the raw request body,
   * and we need to verify the signature before parsing the JSON
   */
  await fastify.register(async (scope) => {
    // Custom content type parser that preserves raw body
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      req.rawBody = body as Buffer;
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
     * POST /webhooks/stripe
     * Handle Stripe webhook events
     * This endpoint receives events from Stripe for subscription updates, payments, etc.
     */
    scope.post(
      '/webhooks/stripe',
      {
        bodyLimit: BODY_LIMIT_STANDARD, // 1MB limit for webhook payloads
        schema: {
          tags: ['Webhooks'],
          summary: 'Stripe webhook handler',
          description:
            'Receives and processes webhook events from Stripe for subscription and payment updates',
          headers: {
            type: 'object',
            properties: {
              'stripe-signature': {
                type: 'string',
                description: 'Stripe webhook signature for verification',
              },
            },
            required: ['stripe-signature'],
          },
          response: {
            200: {
              description: 'Webhook processed successfully',
              type: 'object',
              properties: {
                received: { type: 'boolean' },
              },
            },
            400: {
              description: 'Invalid webhook signature',
              type: 'object',
            },
          },
          security: [], // Public endpoint - authenticated via Stripe signature
        },
      },
      (request, reply) => webhookController.handleWebhook(request, reply),
    );
  });
};
