import { prisma } from 'database';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import type { IUserRepository } from '../interfaces';
import { AuthenticationService } from '../services';
import { revokeAllUserRefreshTokens } from '../utils/refreshToken';

/**
 * AuthController
 * Thin controller layer for authentication routes
 * Delegates business logic to AuthenticationService
 */
@injectable()
export class AuthController {
  constructor(
    @inject(Symbol.for('AuthenticationService'))
    private authService: AuthenticationService,
    @inject(Symbol.for('IUserRepository'))
    private userRepository: IUserRepository,
  ) {}

  /**
   * POST /auth/github
   * Exchange GitHub OAuth code for access token and user info
   */
  async authenticateWithGitHub(request: FastifyRequest, reply: FastifyReply) {
    const { code } = request.body as { code: string };

    if (!code) {
      return reply.status(400).send({ error: 'Code is required' });
    }

    try {
      const jwtSign = (payload: any) => (request.server as any).jwt.sign(payload);
      const result = await this.authService.authenticateWithGitHub(code, jwtSign);

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
    } catch (err: any) {
      console.error('Auth error:', err.message);
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({ error: 'Refresh token not provided' });
    }

    try {
      const { verifyAndRotateRefreshToken } = await import('../utils/refreshToken.js');
      const redisConnection = (request.server as any).redis;
      const result = await verifyAndRotateRefreshToken(
        refreshToken,
        request.server as any,
        redisConnection,
      );

      if (!result) {
        reply.clearCookie('token', { path: '/' });
        reply.clearCookie('refreshToken', { path: '/' });
        return reply.status(401).send({ error: 'Invalid or expired refresh token' });
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

      return { user: result.user, token: result.accessToken };
    } catch (err: any) {
      console.error('Refresh token error:', err.message);
      return reply.status(500).send({ error: 'Token refresh failed' });
    }
  }

  /**
   * POST /auth/logout
   * Revoke all refresh tokens for user
   */
  async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Try to get user from token if present
      try {
        await request.jwtVerify();
        const user = (request as any).user;
        if (user?.id) {
          const redis = (request.server as any).redis;
          await revokeAllUserRefreshTokens(user.id, redis);
        }
      } catch {
        // Token might be invalid, but we still want to clear cookies
      }

      // Clear cookies
      reply.clearCookie('token', { path: '/' });
      reply.clearCookie('refreshToken', { path: '/' });

      return { success: true };
    } catch (err: any) {
      console.error('Logout error:', err.message);
      return reply.status(500).send({ error: 'Logout failed' });
    }
  }

  /**
   * GET /auth/me
   * Get current user info
   */
  async getCurrentUser(request: FastifyRequest) {
    const user = (request as any).user;
    const dbUser = await this.userRepository.findById(user.id);

    if (!dbUser) {
      throw new Error('User not found');
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      avatarUrl: dbUser.avatarUrl,
      hasGitHubConnected: !!dbUser.githubAccessToken,
    };
  }

  /**
   * DELETE /auth/github/disconnect
   * Disconnect GitHub account
   */
  async disconnectGitHub(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;

    await prisma.user.update({
      where: { id: user.id },
      data: { githubAccessToken: null },
    });

    return { success: true };
  }
}
