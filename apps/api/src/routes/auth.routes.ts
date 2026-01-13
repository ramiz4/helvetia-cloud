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
    },
    (request, reply) => authController.loginLocal(request, reply),
  );

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post('/auth/refresh', (request, reply) => authController.refreshToken(request, reply));

  /**
   * POST /auth/logout
   * Revoke all refresh tokens for user
   */
  fastify.post('/auth/logout', (request, reply) => authController.logout(request, reply));

  /**
   * GET /auth/me
   * Get current user info
   */
  fastify.get('/auth/me', { preHandler: authenticate }, async (request, _reply) =>
    authController.getCurrentUser(request),
  );

  /**
   * DELETE /auth/github/disconnect
   * Disconnect GitHub account
   */
  fastify.delete('/auth/github/disconnect', (request, reply) =>
    authController.disconnectGitHub(request, reply),
  );
};
