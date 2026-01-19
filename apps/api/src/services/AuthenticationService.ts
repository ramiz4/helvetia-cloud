import axios from 'axios';
import crypto from 'crypto';
import { Prisma, PrismaClient, Role } from 'database';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens.js';
import type { AuthResponseDto, GitHubUserDto } from '../dto/index.js';
import { UnauthorizedError } from '../errors/index.js';
import type { IUserRepository } from '../interfaces/index.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { hashPassword, isLegacyHash, verifyPassword } from '../utils/password.js';
import { createRefreshToken } from '../utils/refreshToken.js';
import { OrganizationService } from './OrganizationService.js';

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
   * Register a new user with email and password
   */
  async registerWithEmail(
    email: string,
    password: string,
    username: string,
    jwtSign: (payload: { id: string; username: string; role: Role }) => string,
  ): Promise<{ user: AuthResponseDto['user']; accessToken: string; refreshToken: string }> {
    // Check if email and username already exist in parallel
    const [existingUserByEmail, existingUserByUsername] = await Promise.all([
      this.userRepository.findByEmail(email),
      this.userRepository.findByUsername(username),
    ]);

    if (existingUserByEmail) {
      throw new UnauthorizedError('Email already registered');
    }

    if (existingUserByUsername) {
      throw new UnauthorizedError('Username already taken');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await this.userRepository.create({
      email,
      username,
      password: hashedPassword,
      role: Role.MEMBER,
    });

    // Create personal organization
    await this.ensurePersonalOrganization(user.id, user.username);

    // Generate tokens
    const jwtToken = jwtSign({ id: user.id, username: user.username, role: user.role });
    const refreshToken = await createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        githubId: user.githubId,
        role: user.role,
      },
      accessToken: jwtToken,
      refreshToken,
    };
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateWithEmail(
    email: string,
    password: string,
    jwtSign: (payload: { id: string; username: string; role: Role }) => string,
  ): Promise<{ user: AuthResponseDto['user']; accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.password) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if this is a legacy SHA-256 hash
    if (isLegacyHash(user.password)) {
      // Verify using legacy SHA-256 method
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      if (user.password !== hashedPassword) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Migrate to bcrypt on successful login
      const newHash = await hashPassword(password);
      await this.userRepository.update(user.id, { password: newHash });
    } else {
      // Use bcrypt verification for new hashes
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        throw new UnauthorizedError('Invalid email or password');
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
        email: user.email,
        avatarUrl: user.avatarUrl,
        githubId: user.githubId,
        role: user.role,
      },
      accessToken: jwtToken,
      refreshToken,
    };
  }

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
        email: user.email,
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

    // Ensure user has a personal organization
    await this.ensurePersonalOrganization(user.id, user.username);

    // Generate JWT access token (short-lived)
    const jwtToken = jwtSign({ id: user.id, username: user.username, role: user.role });

    // Generate refresh token (long-lived)
    const refreshToken = await createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
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
      email: user.email,
      avatarUrl: user.avatarUrl,
      githubId: user.githubId,
      role: user.role,
    };
  }

  /**
   * Link GitHub account to existing user
   */
  async linkGitHubAccount(
    userId: string,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.githubId) {
      throw new UnauthorizedError('GitHub account already linked');
    }

    // Exchange code for access token
    const accessToken = await this.exchangeCodeForToken(code);

    // Fetch user info from GitHub
    const githubUser = await this.fetchGitHubUser(accessToken);

    // Check if this GitHub account is already linked to another user
    const existingGithubUser = await this.userRepository.findByGithubId(githubUser.id.toString());
    if (existingGithubUser) {
      throw new UnauthorizedError('This GitHub account is already linked to another user');
    }

    // Update user with GitHub info
    const encryptedToken = encrypt(accessToken);
    await this.userRepository.update(userId, {
      githubId: githubUser.id.toString(),
      githubAccessToken: encryptedToken,
      avatarUrl: githubUser.avatar_url,
    });

    return {
      success: true,
      message: 'GitHub account linked successfully',
    };
  }

  /**
   * Disconnect GitHub account (remove access token and GitHub ID)
   * NOTE: Requires email/password authentication to prevent account lockout.
   * In a production system with email verification, consider also checking if email is verified
   * before allowing GitHub disconnection.
   */
  async disconnectGitHub(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Don't allow disconnection if user doesn't have email/password auth
    if (!user.email || !user.password) {
      throw new UnauthorizedError(
        'Cannot disconnect GitHub account without email/password authentication set up',
      );
    }

    await this.userRepository.update(userId, {
      githubAccessToken: null,
      githubId: null,
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

  /**
   * Ensure user has a personal organization
   * Extracted from authenticateWithGitHub for reuse
   */
  private async ensurePersonalOrganization(userId: string, username: string): Promise<void> {
    let retries = 3;
    let created = false;

    while (!created && retries > 0) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Lock the user row to prevent concurrent organization creation for the same user
          await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

          // Check if user has any organizations within the transaction
          const existingOrgs = await tx.organization.findMany({
            where: {
              members: {
                some: {
                  userId: userId,
                },
              },
            },
          });

          // Only create if no organizations exist
          if (existingOrgs.length === 0) {
            // Generate deterministic slug for personal organization
            const slugBase = `${username.toLowerCase().replace(/[^\w-]/g, '-')}-personal`;

            // Check if this specific slug already exists
            const existingOrgWithSlug = await tx.organization.findUnique({
              where: { slug: slugBase },
              include: { members: true },
            });

            if (existingOrgWithSlug) {
              // If it exists, check if user is already a member
              const isMember = existingOrgWithSlug.members.some((m) => m.userId === userId);
              if (isMember) {
                return;
              }

              // Slug is taken by someone else, generate a unique one
              const finalSlug = `${slugBase}-${crypto.randomUUID().substring(0, 7)}`;
              await tx.organization.create({
                data: {
                  name: `${username}'s Personal`,
                  slug: finalSlug,
                  members: {
                    create: {
                      userId: userId,
                      role: Role.OWNER,
                    },
                  },
                },
              });
            } else {
              // Not taken, try to create with base slug
              await tx.organization.create({
                data: {
                  name: `${username}'s Personal`,
                  slug: slugBase,
                  members: {
                    create: {
                      userId: userId,
                      role: Role.OWNER,
                    },
                  },
                },
              });
            }
          }
        });
        created = true;
      } catch (error) {
        // Handle unique constraint violation on slug
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          retries--;
          if (retries === 0) {
            throw new Error(
              'Failed to create organization due to slug collision after multiple retries',
            );
          }
          // The transaction was aborted, so we retry the whole transaction from the start
          continue;
        }
        // Re-throw other errors
        throw error;
      }
    }
  }
}
