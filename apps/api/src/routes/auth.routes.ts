import { prisma } from 'database';
import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_SMALL } from '../config/constants';
import { resolve, TOKENS } from '../di';
import type { IUserRepository } from '../interfaces';
import { AuthenticationService } from '../services';
import type { JwtPayload } from '../types';
import { revokeAllUserRefreshTokens, verifyAndRotateRefreshToken } from '../utils/refreshToken';

/**
 * Auth routes plugin
 * Handles authentication-related endpoints
 */
export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = resolve<AuthenticationService>(TOKENS.AuthenticationService);
  const userRepository = resolve<IUserRepository>(TOKENS.UserRepository);

  /**
   * POST /auth/github
   * Exchange GitHub OAuth code for access token and user info
   */
  fastify.post(
    '/auth/github',
    {
      bodyLimit: BODY_LIMIT_SMALL, // 100KB limit for auth requests
    },
    async (request, reply) => {
      const { code } = request.body as { code: string };

      if (!code) {
        return reply.status(400).send({ error: 'Code is required' });
      }

      try {
        const jwtSign = (payload: JwtPayload) => fastify.jwt.sign(payload);
        const result = await authService.authenticateWithGitHub(code, jwtSign);

        // Set cookies
        reply.setCookie('token', result.accessToken, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 15, // 15 minutes
        });

        reply.setCookie('refreshToken', result.refreshToken, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        return { user: result.user, token: result.accessToken };
      } catch (err: unknown) {
        const error = err as Error;
        console.error('Auth error:', error.message);
        return reply.status(500).send({ error: 'Authentication failed' });
      }
    },
  );

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post('/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({ error: 'Refresh token not provided' });
    }

    try {
      const redisConnection = fastify.redis;
      const result = await verifyAndRotateRefreshToken(refreshToken, fastify, redisConnection);

      if (!result) {
        reply.clearCookie('token', { path: '/' });
        reply.clearCookie('refreshToken', { path: '/' });
        return reply.status(401).send({ error: 'Invalid or expired refresh token' });
      }

      // Fetch user for response
      const user = await userRepository.findById(result.userId);
      if (!user) {
        return reply.status(401).send({ error: 'User not found' });
      }

      // Set new cookies
      reply.setCookie('token', result.accessToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 15,
      });

      reply.setCookie('refreshToken', result.refreshToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });

      return {
        user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
        token: result.accessToken,
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Refresh token error:', error.message);
      return reply.status(500).send({ error: 'Token refresh failed' });
    }
  });

  /**
   * POST /auth/logout
   * Revoke all refresh tokens for user
   */
  fastify.post('/auth/logout', async (request, reply) => {
    try {
      // Try to get user from token if present
      try {
        await request.jwtVerify();
        const user = request.user;
        if (user?.id) {
          const redisConnection = fastify.redis;
          await revokeAllUserRefreshTokens(user.id, redisConnection);
        }
      } catch {
        // Token might be invalid, but we still want to clear cookies
      }

      // Clear cookies
      reply.clearCookie('token', { path: '/' });
      reply.clearCookie('refreshToken', { path: '/' });

      return { success: true };
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Logout error:', error.message);
      return reply.status(500).send({ error: 'Logout failed' });
    }
  });

  /**
   * GET /auth/me
   * Get current user info
   */
  fastify.get('/auth/me', async (request) => {
    const user = request.user;
    if (!user) {
      throw new Error('User not found');
    }
    const dbUser = await userRepository.findById(user.id);

    if (!dbUser) {
      throw new Error('User not found');
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      avatarUrl: dbUser.avatarUrl,
      hasGitHubConnected: !!dbUser.githubAccessToken,
    };
  });

  /**
   * DELETE /auth/github/disconnect
   * Disconnect GitHub account
   */
  fastify.delete('/auth/github/disconnect', async (request) => {
    const user = request.user;
    if (!user) {
      throw new Error('User not found');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { githubAccessToken: null },
    });

    return { success: true };
  });
};
