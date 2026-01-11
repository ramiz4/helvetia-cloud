import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import type { AuthResponseDto, GitHubUserDto } from '../dto';
import { UnauthorizedError } from '../errors';
import type { IUserRepository } from '../interfaces';
import { decrypt, encrypt } from '../utils/crypto';
import { createRefreshToken } from '../utils/refreshToken';

/**
 * AuthenticationService
 * Handles business logic for authentication operations
 */
@injectable()
export class AuthenticationService {
  constructor(
    @inject(Symbol.for('IUserRepository'))
    private userRepository: IUserRepository,
  ) {}

  /**
   * Authenticate user with GitHub OAuth code
   * Returns user and tokens
   */
  async authenticateWithGitHub(
    code: string,
    jwtSign: (payload: any) => string,
  ): Promise<{ user: AuthResponseDto['user']; accessToken: string; refreshToken: string }> {
    if (!code) {
      throw new UnauthorizedError('Authorization code is required');
    }

    // Exchange code for access token
    const accessToken = await this.exchangeCodeForToken(code);

    // Fetch user info from GitHub
    const githubUser = await this.fetchGitHubUser(accessToken);

    // Upsert user in database
    const encryptedToken = encrypt(accessToken);
    const user = await this.userRepository.upsert(
      { githubId: githubUser.id.toString() },
      {
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        githubAccessToken: encryptedToken,
      },
      {
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        githubAccessToken: encryptedToken,
      },
    );

    // Generate JWT access token (short-lived)
    const jwtToken = jwtSign({ id: user.id, username: user.username });

    // Generate refresh token (long-lived)
    const refreshToken = await createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        githubId: user.githubId,
      },
      accessToken: jwtToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using refresh token
   * Note: This is a simplified version. In production, you'd want to inject
   * FastifyInstance and Redis to use verifyAndRotateRefreshToken utility
   */
  async refreshAccessToken(
    refreshToken: string,
    jwtSign: (payload: any) => string,
  ): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    // For now, we'll implement a basic version
    // In a full implementation, you'd inject Redis and use the utility function
    const { prisma } = await import('database');

    // Find the refresh token in database
    const refreshTokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!refreshTokenRecord) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Check if token is revoked
    if (refreshTokenRecord.revoked) {
      throw new UnauthorizedError('Refresh token has been revoked');
    }

    // Check if token is expired
    if (new Date() > refreshTokenRecord.expiresAt) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    const user = refreshTokenRecord.user;

    // Generate new JWT access token
    const newAccessToken = jwtSign({ id: user.id, username: user.username });

    // Generate new refresh token
    const newRefreshToken = await createRefreshToken(user.id);

    // Mark old refresh token as revoked
    await prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { revoked: true },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      userId: user.id,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      githubId: user.githubId,
    };
  }

  /**
   * Disconnect GitHub account (remove access token)
   */
  async disconnectGitHub(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    await this.userRepository.update(userId, {
      githubAccessToken: null,
    });
  }

  /**
   * Get decrypted GitHub access token for a user
   */
  async getGitHubAccessToken(userId: string): Promise<string | null> {
    const user = await this.userRepository.findById(userId);

    if (!user || !user.githubAccessToken) {
      return null;
    }

    return decrypt(user.githubAccessToken);
  }

  /**
   * Exchange GitHub OAuth code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<string> {
    try {
      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        },
        {
          headers: { Accept: 'application/json' },
        },
      );

      const { access_token, error } = response.data;

      if (error) {
        throw new UnauthorizedError(`GitHub OAuth error: ${error}`);
      }

      if (!access_token) {
        throw new UnauthorizedError('Failed to obtain access token from GitHub');
      }

      return access_token;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError('Failed to authenticate with GitHub');
    }
  }

  /**
   * Fetch GitHub user information
   */
  private async fetchGitHubUser(accessToken: string): Promise<GitHubUserDto> {
    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${accessToken}` },
      });

      return response.data;
    } catch {
      throw new UnauthorizedError('Failed to fetch user information from GitHub');
    }
  }
}
