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
     * POST /webhooks/github
     * GitHub webhook endpoint for Push and Pull Request events
     */
    scope.post(
      '/webhooks/github',
      {
        config: { rateLimit: authRateLimitConfig },
        bodyLimit: BODY_LIMIT_STANDARD, // 1MB limit for webhook payloads
        schema: {
          tags: ['Webhooks'],
          summary: 'GitHub webhook handler',
          description: `
Handle GitHub webhook events for automated deployments.

**Supported Events:**
- \`push\`: Trigger deployment on push to configured branch
- \`pull_request\`: Create preview deployment for pull requests

**Configuration:**
1. Go to your repository settings on GitHub
2. Navigate to Webhooks → Add webhook
3. Set Payload URL: \`https://your-domain.com/api/v1/webhooks/github\`
4. Set Content type: \`application/json\`
5. Set Secret: Your webhook secret (from service settings)
6. Select events: Push, Pull request
7. Save webhook

**Webhook Signature Verification:**
All webhook requests are verified using HMAC SHA-256 signature in the \`X-Hub-Signature-256\` header.
          `,
          headers: {
            type: 'object',
            properties: {
              'x-github-event': {
                type: 'string',
                description: 'GitHub event type',
                enum: ['push', 'pull_request', 'ping'],
                example: 'push',
              },
              'x-github-delivery': {
                type: 'string',
                description: 'Unique delivery ID',
                example: '12345678-1234-1234-1234-123456789012',
              },
              'x-hub-signature-256': {
                type: 'string',
                description: 'HMAC SHA-256 signature',
                example: 'sha256=abc123def456...',
              },
            },
          },
          body: {
            type: 'object',
            description: 'GitHub webhook payload (varies by event type)',
            additionalProperties: true,
            properties: {
              repository: {
                type: 'object',
                description: 'Repository information',
                properties: {
                  id: {
                    type: 'number',
                    example: 123456789,
                  },
                  name: {
                    type: 'string',
                    example: 'my-repo',
                  },
                  full_name: {
                    type: 'string',
                    example: 'user/my-repo',
                  },
                  clone_url: {
                    type: 'string',
                    format: 'uri',
                    example: 'https://github.com/user/my-repo.git',
                  },
                },
              },
              ref: {
                type: 'string',
                description: 'Git reference (for push events)',
                example: 'refs/heads/main',
              },
              after: {
                type: 'string',
                description: 'Commit SHA after push',
                example: 'abc123def456',
              },
              pull_request: {
                type: 'object',
                description: 'Pull request information (for PR events)',
                properties: {
                  number: {
                    type: 'number',
                    example: 42,
                  },
                  head: {
                    type: 'object',
                    properties: {
                      ref: {
                        type: 'string',
                        example: 'feature-branch',
                      },
                      sha: {
                        type: 'string',
                        example: 'def456ghi789',
                      },
                    },
                  },
                },
              },
            },
          },
          response: {
            200: {
              description: 'Webhook processed successfully',
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Webhook processed successfully',
                },
                deploymentId: {
                  type: 'string',
                  description: 'ID of created deployment (if applicable)',
                },
              },
            },
            400: {
              description: 'Bad request - invalid payload or signature',
              type: 'object',
            },
            401: {
              description: 'Unauthorized - invalid signature',
              type: 'object',
            },
            404: {
              description: 'Service not found for repository',
              type: 'object',
            },
          },
          security: [], // Public endpoint (verified via signature)
        },
      },
      async (request, reply) => {
        return controller.handleGitHubWebhook(request, reply);
      },
    );
  });
};
