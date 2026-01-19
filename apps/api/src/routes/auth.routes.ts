import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_SMALL } from '../config/constants.js';
import { AuthController } from '../controllers/AuthController.js';
import { resolve, TOKENS } from '../di/index.js';
import { authenticate } from '../middleware/auth.middleware.js';

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
   * POST /auth/register
   * Register with email and password
   */
  fastify.post(
    '/auth/register',
    {
      config: { rateLimit: authRateLimitConfig },
      bodyLimit: BODY_LIMIT_SMALL,
      schema: {
        tags: ['Authentication'],
        summary: 'Register with email and password',
        description: 'Create a new account with email, password, and username. Returns JWT tokens.',
        body: {
          type: 'object',
          required: ['email', 'password', 'username'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'User password (min 8 characters)',
              example: 'SecurePass123!',
              minLength: 8,
            },
            username: {
              type: 'string',
              description: 'Username',
              example: 'johndoe',
              minLength: 3,
              maxLength: 30,
            },
          },
        },
        response: {
          200: {
            description: 'Registration successful',
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
            description: 'Bad request - validation error or user already exists',
            type: 'object',
          },
        },
        security: [], // Public endpoint
      },
    },
    (request, reply) => authController.register(request, reply),
  );

  /**
   * POST /auth/login
   * Login with email/username and password
   */
  fastify.post(
    '/auth/login',
    {
      config: { rateLimit: authRateLimitConfig },
      bodyLimit: BODY_LIMIT_SMALL,
      schema: {
        tags: ['Authentication'],
        summary: 'Login with credentials',
        description:
          'Authenticate with email or username and password. If email is provided, it takes priority over username. Returns JWT tokens.',
        body: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com',
            },
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
          anyOf: [{ required: ['email', 'password'] }, { required: ['username', 'password'] }],
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
   * POST /auth/github/link
   * Link GitHub account to existing user
   */
  fastify.post(
    '/auth/github/link',
    {
      preHandler: authenticate,
      config: { rateLimit: authRateLimitConfig },
      bodyLimit: BODY_LIMIT_SMALL,
      schema: {
        tags: ['Authentication'],
        summary: 'Link GitHub account',
        description: 'Connect GitHub account to existing email/password user account.',
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
            description: 'GitHub account linked successfully',
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
              },
              message: {
                type: 'string',
                example: 'GitHub account linked successfully',
              },
            },
          },
          400: {
            description: 'Bad request - invalid code or account already linked',
            type: 'object',
          },
          401: {
            description: 'Unauthorized - missing or invalid token',
            type: 'object',
          },
        },
      },
    },
    (request, reply) => authController.linkGitHub(request, reply),
  );

  /**
   * DELETE /auth/github/disconnect
   * Disconnect GitHub account
   */
  fastify.delete(
    '/auth/github/disconnect',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Authentication'],
        summary: 'Disconnect GitHub account',
        description:
          'Remove GitHub account connection from user profile. Requires email/password auth to be set up.',
        response: {
          200: {
            description: 'GitHub account disconnected',
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
              },
              message: {
                type: 'string',
                example: 'GitHub account disconnected successfully',
              },
            },
          },
          400: {
            description: 'Bad request - cannot disconnect without email/password auth',
            type: 'object',
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
