import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_SMALL } from '../config/constants';
import { AuthController } from '../controllers/AuthController';
import { resolve, TOKENS } from '../di';
import { authenticate } from '../middleware/auth.middleware';

/**
 * Auth routes plugin
 * Handles authentication-related endpoints
 */
export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authController = resolve<AuthController>(TOKENS.AuthController);
  const redisConnection = fastify.redis;
  const { createRateLimitConfigs } = await import('../config/rateLimit.js');
  const { authRateLimitConfig } = createRateLimitConfigs(redisConnection);

  /**
   * POST /auth/github
   * Exchange GitHub OAuth code for access token and user info
   */
  fastify.post(
    '/auth/github',
    {
      config: { rateLimit: authRateLimitConfig },
      bodyLimit: BODY_LIMIT_SMALL, // 100KB limit for auth requests
      schema: {
        tags: ['Authentication'],
        summary: 'Authenticate with GitHub',
        description:
          'Exchange GitHub OAuth code for JWT tokens. Returns access token and refresh token.',
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: {
              type: 'string',
              description: 'GitHub OAuth authorization code',
              example: 'abc123def456',
            },
          },
        },
        response: {
          200: {
            description: 'Authentication successful',
            type: 'object',
            properties: {
              accessToken: {
                type: 'string',
                description: 'JWT access token (expires in 15 minutes)',
              },
              refreshToken: {
                type: 'string',
                description: 'Refresh token (expires in 7 days)',
              },
              user: {
                type: 'object',
              },
            },
          },
          400: {
            description: 'Bad request - invalid code',
            type: 'object',
          },
          401: {
            description: 'Unauthorized - GitHub authentication failed',
            type: 'object',
          },
        },
        security: [], // Public endpoint
      },
    },
    (request, reply) => authController.authenticateWithGitHub(request, reply),
  );

  /**
   * POST /auth/login
   * Login with username and password (local admin)
   */
  fastify.post(
    '/auth/login',
    {
      config: { rateLimit: authRateLimitConfig },
      bodyLimit: BODY_LIMIT_SMALL,
      schema: {
        tags: ['Authentication'],
        summary: 'Login with credentials',
        description: 'Authenticate with username and password. Returns JWT tokens.',
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Username',
              example: 'admin',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'User password',
              example: 'SecurePass123!',
            },
          },
        },
        response: {
          200: {
            description: 'Login successful',
            type: 'object',
            properties: {
              accessToken: {
                type: 'string',
                description: 'JWT access token (expires in 15 minutes)',
              },
              refreshToken: {
                type: 'string',
                description: 'Refresh token (expires in 7 days)',
              },
              user: {
                type: 'object',
              },
            },
          },
          400: {
            description: 'Bad request - missing fields',
            type: 'object',
          },
          401: {
            description: 'Unauthorized - invalid credentials',
            type: 'object',
          },
        },
        security: [], // Public endpoint
      },
    },
    (request, reply) => authController.loginLocal(request, reply),
  );

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post(
    '/auth/refresh',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description:
          'Obtain a new access token using a refresh token. Requires refreshToken field in request body.',
        response: {
          200: {
            description: 'Token refreshed successfully',
            type: 'object',
            properties: {
              accessToken: {
                type: 'string',
                description: 'New JWT access token (expires in 15 minutes)',
              },
            },
          },
          401: {
            description: 'Unauthorized - invalid or expired refresh token',
            type: 'object',
          },
        },
        security: [], // Public endpoint
      },
    },
    (request, reply) => authController.refreshToken(request, reply),
  );

  /**
   * POST /auth/logout
   * Revoke all refresh tokens for user
   */
  fastify.post(
    '/auth/logout',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Logout',
        description: 'Revoke all refresh tokens for the authenticated user.',
        response: {
          200: {
            description: 'Logout successful',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Logged out successfully',
              },
            },
          },
        },
        security: [], // Public endpoint (handles logout even without valid token)
      },
    },
    (request, reply) => authController.logout(request, reply),
  );

  /**
   * GET /auth/me
   * Get current user info
   */
  fastify.get(
    '/auth/me',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Authentication'],
        summary: 'Get current user',
        description: 'Retrieve information about the currently authenticated user.',
        response: {
          200: {
            description: 'User information',
            type: 'object',
          },
          401: {
            description: 'Unauthorized - missing or invalid token',
            type: 'object',
          },
        },
      },
    },
    async (request, _reply) => authController.getCurrentUser(request),
  );

  /**
   * DELETE /auth/github/disconnect
   * Disconnect GitHub account
   */
  fastify.delete(
    '/auth/github/disconnect',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Disconnect GitHub account',
        description: 'Remove GitHub account connection from user profile.',
        response: {
          200: {
            description: 'GitHub account disconnected',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'GitHub account disconnected successfully',
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
    (request, reply) => authController.disconnectGitHub(request, reply),
  );
};
