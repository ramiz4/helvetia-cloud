import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_SMALL } from '../config/constants.js';
import { createRateLimitConfigs } from '../config/rateLimit.js';
import { TermsController } from '../controllers/TermsController.js';
import { resolve, TOKENS } from '../di/index.js';
import { authenticate } from '../middleware/auth.middleware.js';

/**
 * Terms of Service routes
 */
export const termsRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<TermsController>(TOKENS.TermsController);

  // Setup rate limiting
  const redis = fastify.redis;
  const { authRateLimitConfig } = createRateLimitConfigs(redis);

  /**
   * GET /terms/latest
   * Get the latest version of terms for a specific language (public)
   */
  fastify.get(
    '/terms/latest',
    {
      config: { rateLimit: authRateLimitConfig },
      schema: {
        tags: ['Terms of Service'],
        summary: 'Get latest terms of service',
        description: 'Retrieve the latest version of terms of service for a specific language.',
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
            description: 'Latest terms of service',
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
            description: 'Terms not found for specified language',
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
      return controller.getLatestTerms(request, reply);
    },
  );

  /**
   * GET /terms/version
   * Get terms by specific version and language (public)
   */
  fastify.get(
    '/terms/version',
    {
      config: { rateLimit: authRateLimitConfig },
      schema: {
        tags: ['Terms of Service'],
        summary: 'Get terms by version',
        description: 'Retrieve a specific version of terms of service.',
        querystring: {
          type: 'object',
          required: ['version'],
          properties: {
            version: {
              type: 'string',
              example: '1.0.0',
              description: 'Terms version',
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
            description: 'Terms of service for specified version',
            type: 'object',
          },
          400: {
            description: 'Validation error',
            type: 'object',
          },
          404: {
            description: 'Terms version not found',
            type: 'object',
          },
        },
        security: [], // Public endpoint
      },
    },
    async (request, reply) => {
      return controller.getTermsByVersion(request, reply);
    },
  );

  /**
   * GET /terms/versions
   * Get all versions of terms for a specific language (public)
   */
  fastify.get(
    '/terms/versions',
    {
      config: { rateLimit: authRateLimitConfig },
      schema: {
        tags: ['Terms of Service'],
        summary: 'List all terms versions',
        description: 'Retrieve all versions of terms of service for a specific language.',
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
            description: 'List of terms versions',
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
   * POST /terms/accept
   * Accept terms of service (authenticated)
   */
  fastify.post(
    '/terms/accept',
    {
      preHandler: [authenticate],
      bodyLimit: BODY_LIMIT_SMALL,
      config: { rateLimit: authRateLimitConfig },
      schema: {
        tags: ['Terms of Service'],
        summary: 'Accept terms of service',
        description: 'Record user acceptance of a specific terms version.',
        body: {
          type: 'object',
          required: ['termsVersionId'],
          properties: {
            termsVersionId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the terms version being accepted',
            },
          },
        },
        response: {
          201: {
            description: 'Terms accepted successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  userId: { type: 'string', format: 'uuid' },
                  termsVersionId: { type: 'string', format: 'uuid' },
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
      return controller.acceptTerms(request, reply);
    },
  );

  /**
   * GET /terms/check-acceptance
   * Check if user needs to accept latest terms (authenticated)
   */
  fastify.get(
    '/terms/check-acceptance',
    {
      preHandler: [authenticate],
      config: { rateLimit: authRateLimitConfig },
      schema: {
        tags: ['Terms of Service'],
        summary: 'Check terms acceptance status',
        description: 'Check if the authenticated user has accepted the latest terms.',
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
                    description: 'Whether user needs to accept new terms',
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
