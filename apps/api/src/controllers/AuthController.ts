import '../types/fastify';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import type { IUserRepository } from '../interfaces';
import { AuthenticationService } from '../services';
import type { JwtPayload } from '../types';
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
      const jwtSign = (payload: JwtPayload) => request.server.jwt.sign(payload);
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
    } catch (err: unknown) {
      request.log.error({ err }, 'GitHub authentication failed');
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  }

  /**
   * POST /auth/register
   * Register with email and password
   */
  async register(request: FastifyRequest, reply: FastifyReply) {
    const { email, password, username } = request.body as {
      email?: string;
      password?: string;
      username?: string;
    };

    if (!email || !password || !username) {
      return reply.status(400).send({ error: 'Email, password, and username are required' });
    }

    // Basic server-side validation for defense-in-depth
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return reply.status(400).send({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters long' });
    }

    if (username.length < 3 || username.length > 30) {
      return reply.status(400).send({ error: 'Username must be between 3 and 30 characters long' });
    }

    try {
      const jwtSign = (payload: JwtPayload) => request.server.jwt.sign(payload);
      const result = await this.authService.registerWithEmail(email, password, username, jwtSign);

      // Set cookies
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
    } catch (err: unknown) {
      if ((err as Error).name === 'UnauthorizedError') {
        return reply.status(400).send({ error: (err as Error).message });
      }
      request.log.error({ err }, 'Registration failed');
      return reply.status(500).send({ error: 'Registration failed' });
    }
  }

  /**
   * POST /auth/login
   * Login with email/username and password
   */
  async loginLocal(request: FastifyRequest, reply: FastifyReply) {
    const { email, username, password } = request.body as {
      email?: string;
      username?: string;
      password?: string;
    };

    if ((!email && !username) || !password) {
      return reply.status(400).send({ error: 'Email or username and password are required' });
    }

    // Basic server-side validation for defense-in-depth
    if (email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        return reply.status(400).send({ error: 'Invalid email format' });
      }
    }

    if (username && (username.length < 3 || username.length > 30)) {
      return reply.status(400).send({ error: 'Username must be between 3 and 30 characters long' });
    }

    try {
      const jwtSign = (payload: JwtPayload) => request.server.jwt.sign(payload);

      // Try email login first if email is provided
      let result;
      if (email) {
        result = await this.authService.authenticateWithEmail(email, password, jwtSign);
      } else if (username) {
        result = await this.authService.authenticateLocal(username, password, jwtSign);
      } else {
        return reply.status(400).send({ error: 'Email or username is required' });
      }

      // Set cookies
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
    } catch (err: unknown) {
      if ((err as Error).name === 'UnauthorizedError') {
        return reply.status(401).send({ error: (err as Error).message });
      }
      request.log.error({ err }, 'Local authentication failed');
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
      return reply.status(400).send({ error: 'Refresh token not provided' });
    }

    try {
      const { verifyAndRotateRefreshToken } = await import('../utils/refreshToken.js');
      const redisConnection = request.server.redis;
      const result = await verifyAndRotateRefreshToken(
        refreshToken,
        request.server,
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

      return {
        accessToken: result.accessToken,
        message: 'Token refreshed successfully',
      };
    } catch (err: unknown) {
      request.log.error({ err }, 'Token refresh failed');
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
        const user = request.user;
        if (user?.id) {
          const redis = request.server.redis;
          await revokeAllUserRefreshTokens(user.id, redis);
        }
      } catch {
        // Token might be invalid, but we still want to clear cookies
      }

      // Clear cookies
      reply.clearCookie('token', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      reply.clearCookie('refreshToken', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return { message: 'Logged out successfully' };
    } catch (err: unknown) {
      request.log.error({ err }, 'Logout failed');
      return reply.status(500).send({ error: 'Logout failed' });
    }
  }

  /**
   * GET /auth/me
   * Get current user info
   */
  async getCurrentUser(request: FastifyRequest) {
    const user = request.user;
    if (!user) {
      throw new Error('User not authenticated');
    }
    const dbUser = await this.userRepository.findById(user.id);

    if (!dbUser) {
      throw new Error('User not found');
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      avatarUrl: dbUser.avatarUrl,
      githubId: dbUser.githubId,
      hasGitHubConnected: !!dbUser.githubAccessToken,
      hasPasswordAuth: !!dbUser.password,
    };
  }

  /**
   * POST /auth/github/link
   * Link GitHub account to existing user
   */
  async linkGitHub(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const { code } = request.body as { code?: string };
    if (!code) {
      return reply.status(400).send({ error: 'GitHub authorization code is required' });
    }

    try {
      const result = await this.authService.linkGitHubAccount(user.id, code);
      return result;
    } catch (err: unknown) {
      if ((err as Error).name === 'UnauthorizedError') {
        return reply.status(400).send({ error: (err as Error).message });
      }
      request.log.error({ err }, 'Failed to link GitHub account');
      return reply.status(500).send({ error: 'Failed to link GitHub account' });
    }
  }

  /**
   * DELETE /auth/github/disconnect
   * Disconnect GitHub account
   */
  async disconnectGitHub(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      await this.authService.disconnectGitHub(user.id);
      return { success: true, message: 'GitHub account disconnected successfully' };
    } catch (err: unknown) {
      if ((err as Error).name === 'UnauthorizedError') {
        return reply.status(400).send({ error: (err as Error).message });
      }
      request.log.error({ err }, 'Failed to disconnect GitHub account');
      return reply.status(500).send({ error: 'Failed to disconnect GitHub account' });
    }
  }
}
