import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_SMALL } from '../config/constants.js';
import { createRateLimitConfigs } from '../config/rateLimit.js';
import { PrivacyPolicyController } from '../controllers/PrivacyPolicyController.js';
import { resolve, TOKENS } from '../di/index.js';
import { authenticate } from '../middleware/auth.middleware.js';

/**
 * Privacy Policy routes
 */
export const privacyPolicyRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<PrivacyPolicyController>(TOKENS.PrivacyPolicyController);

  // Setup rate limiting
  const redis = fastify.redis;
  const { standardRateLimitConfig } = createRateLimitConfigs(redis);

  /**
   * GET /privacy-policy/latest
   * Get the latest version of privacy policy for a specific language (public)
   */
  fastify.get(
    '/privacy-policy/latest',
    {
      config: { rateLimit: standardRateLimitConfig },
      schema: {
        tags: ['Privacy Policy'],
        summary: 'Get latest privacy policy',
        description: 'Retrieve the latest version of privacy policy for a specific language.',
        querystring: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['en', 'de', 'fr', 'it', 'gsw'],
              default: 'en',
              description: 'Language code',
            },
          },
        },
        response: {
          200: {
            description: 'Latest privacy policy',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  version: { type: 'string', example: '1.0.0' },
                  content: { type: 'string', description: 'Markdown content' },
                  language: { type: 'string', example: 'en' },
                  effectiveAt: { type: 'string', format: 'date-time' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          404: {
            description: 'Privacy policy not found for specified language',
            type: 'object',
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
        security: [], // Public endpoint
      },
    },
    async (request, reply) => {
      return controller.getLatestPrivacyPolicy(request, reply);
    },
  );

  /**
   * GET /privacy-policy/version
   * Get privacy policy by specific version and language (public)
   */
  fastify.get(
    '/privacy-policy/version',
    {
      config: { rateLimit: standardRateLimitConfig },
      schema: {
        tags: ['Privacy Policy'],
        summary: 'Get privacy policy by version',
        description: 'Retrieve a specific version of privacy policy.',
        querystring: {
          type: 'object',
          required: ['version'],
          properties: {
            version: {
              type: 'string',
              example: '1.0.0',
              description: 'Privacy policy version',
            },
            language: {
              type: 'string',
              enum: ['en', 'de', 'fr', 'it', 'gsw'],
              default: 'en',
              description: 'Language code',
            },
          },
        },
        response: {
          200: {
            description: 'Privacy policy for specified version',
            type: 'object',
          },
          400: {
            description: 'Validation error',
            type: 'object',
          },
          404: {
            description: 'Privacy policy version not found',
            type: 'object',
          },
        },
        security: [], // Public endpoint
      },
    },
    async (request, reply) => {
      return controller.getPrivacyPolicyByVersion(request, reply);
    },
  );

  /**
   * GET /privacy-policy/versions
   * Get all versions of privacy policy for a specific language (public)
   */
  fastify.get(
    '/privacy-policy/versions',
    {
      config: { rateLimit: standardRateLimitConfig },
      schema: {
        tags: ['Privacy Policy'],
        summary: 'List all privacy policy versions',
        description: 'Retrieve all versions of privacy policy for a specific language.',
        querystring: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['en', 'de', 'fr', 'it', 'gsw'],
              default: 'en',
              description: 'Language code',
            },
          },
        },
        response: {
          200: {
            description: 'List of privacy policy versions',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    version: { type: 'string' },
                    language: { type: 'string' },
                    effectiveAt: { type: 'string', format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
        security: [], // Public endpoint
      },
    },
    async (request, reply) => {
      return controller.getAllVersions(request, reply);
    },
  );

  /**
   * POST /privacy-policy/accept
   * Accept privacy policy (authenticated)
   */
  fastify.post(
    '/privacy-policy/accept',
    {
      preHandler: [authenticate],
      bodyLimit: BODY_LIMIT_SMALL,
      config: { rateLimit: standardRateLimitConfig },
      schema: {
        tags: ['Privacy Policy'],
        summary: 'Accept privacy policy',
        description: 'Record user acceptance of a specific privacy policy version.',
        body: {
          type: 'object',
          required: ['privacyPolicyVersionId'],
          properties: {
            privacyPolicyVersionId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the privacy policy version being accepted',
            },
          },
        },
        response: {
          201: {
            description: 'Privacy policy accepted successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  userId: { type: 'string', format: 'uuid' },
                  privacyPolicyVersionId: { type: 'string', format: 'uuid' },
                  acceptedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.acceptPrivacyPolicy(request, reply);
    },
  );

  /**
   * GET /privacy-policy/check-acceptance
   * Check if user needs to accept latest privacy policy (authenticated)
   */
  fastify.get(
    '/privacy-policy/check-acceptance',
    {
      preHandler: [authenticate],
      config: { rateLimit: standardRateLimitConfig },
      schema: {
        tags: ['Privacy Policy'],
        summary: 'Check privacy policy acceptance status',
        description: 'Check if the authenticated user has accepted the latest privacy policy.',
        querystring: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['en', 'de', 'fr', 'it', 'gsw'],
              default: 'en',
              description: 'Language code',
            },
          },
        },
        response: {
          200: {
            description: 'Acceptance status',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  requiresAcceptance: {
                    type: 'boolean',
                    description: 'Whether user needs to accept new privacy policy',
                  },
                  latestVersion: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      version: { type: 'string' },
                      effectiveAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.checkAcceptance(request, reply);
    },
  );
};
