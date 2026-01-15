import axios from 'axios';
import crypto from 'crypto';
import { Prisma, PrismaClient, Role } from 'database';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import type { AuthResponseDto, GitHubUserDto } from '../dto';
import { UnauthorizedError } from '../errors';
import type { IUserRepository } from '../interfaces';
import { decrypt, encrypt } from '../utils/crypto';
import { hashPassword, isLegacyHash, verifyPassword } from '../utils/password';
import { createRefreshToken } from '../utils/refreshToken';
import { OrganizationService } from './OrganizationService';

/**
 * AuthenticationService
 * Handles business logic for authentication operations
 */
@injectable()
export class AuthenticationService {
  constructor(
    @inject(Symbol.for('IUserRepository'))
    private userRepository: IUserRepository,
    @inject(Symbol.for('OrganizationService'))
    private organizationService: OrganizationService,
    @inject(TOKENS.PrismaClient)
    private prisma: PrismaClient,
  ) {}

  /**
   * Authenticate user with username and password (local admin)
   */
  async authenticateLocal(
    username: string,
    password: string,
    jwtSign: (payload: { id: string; username: string; role: Role }) => string,
  ): Promise<{ user: AuthResponseDto['user']; accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findByUsername(username);

    if (!user || !user.password) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Check if this is a legacy SHA-256 hash
    if (isLegacyHash(user.password)) {
      // Verify using legacy SHA-256 method
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      if (user.password !== hashedPassword) {
        throw new UnauthorizedError('Invalid username or password');
      }

      // Migrate to bcrypt on successful login
      const newHash = await hashPassword(password);
      await this.userRepository.update(user.id, { password: newHash });
    } else {
      // Use bcrypt verification for new hashes
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        throw new UnauthorizedError('Invalid username or password');
      }
    }

    // Generate JWT access token
    const jwtToken = jwtSign({ id: user.id, username: user.username, role: user.role });

    // Generate refresh token
    const refreshToken = await createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        githubId: user.githubId,
        role: user.role,
      },
      accessToken: jwtToken,
      refreshToken,
    };
  }

  /**
   * Authenticate user with GitHub OAuth code
   * Returns user and tokens
   */
  async authenticateWithGitHub(
    code: string,
    jwtSign: (payload: { id: string; username: string; role: Role }) => string,
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

    // Ensure user has a personal organization within a transaction to prevent race conditions
    // This handles concurrent authentication requests safely
    await this.prisma.$transaction(async (tx) => {
      // Check if user has any organizations within the transaction
      const existingOrgs = await tx.organization.findMany({
        where: {
          members: {
            some: {
              userId: user.id,
            },
          },
        },
      });

      // Only create if no organizations exist
      if (existingOrgs.length === 0) {
        // Generate slug for personal organization
        const slug = `${user.username.toLowerCase().replace(/[^\w-]/g, '-')}-personal`;

        // Use a retry loop to handle potential slug collisions
        let retries = 3;
        let created = false;

        while (!created && retries > 0) {
          try {
            // Check if slug exists and generate unique one if needed
            const existingSlug = await tx.organization.findUnique({
              where: { slug },
            });

            const finalSlug = existingSlug
              ? `${slug}-${crypto.randomUUID().substring(0, 7)}`
              : slug;

            // Create organization with member in a single operation
            await tx.organization.create({
              data: {
                name: `${user.username}'s Personal`,
                slug: finalSlug,
                members: {
                  create: {
                    userId: user.id,
                    role: Role.OWNER,
                  },
                },
              },
            });

            created = true;
          } catch (error) {
            // Handle unique constraint violation on slug
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              retries--;
              if (retries === 0) {
                throw new Error('Failed to create organization due to slug collision');
              }
              // Retry with a new UUID
              continue;
            }
            // Re-throw other errors
            throw error;
          }
        }
      }
    });

    // Generate JWT access token (short-lived)
    const jwtToken = jwtSign({ id: user.id, username: user.username, role: user.role });

    // Generate refresh token (long-lived)
    const refreshToken = await createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        githubId: user.githubId,
        role: user.role,
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
    jwtSign: (payload: { id: string; username: string; role: Role }) => string,
  ): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    // Find the refresh token in database
    const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
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
    const newAccessToken = jwtSign({ id: user.id, username: user.username, role: user.role });

    // Generate new refresh token
    const newRefreshToken = await createRefreshToken(user.id);

    // Mark old refresh token as revoked
    await this.prisma.refreshToken.update({
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
      role: user.role,
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
