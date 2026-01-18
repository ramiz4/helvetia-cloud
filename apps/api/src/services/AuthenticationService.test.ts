import axios from 'axios';
import crypto from 'crypto';
import { Role } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../errors';
import type { IUserRepository } from '../interfaces';
import * as passwordUtils from '../utils/password';
import { AuthenticationService } from './AuthenticationService';
import { OrganizationService } from './OrganizationService';

vi.mock('axios');
vi.mock('database', async () => {
  const actual = await vi.importActual('database');
  return {
    ...actual,
    prisma: {
      $transaction: vi.fn(async (callback) => {
        // Mock transaction context
        const mockTx = {
          $executeRaw: vi.fn().mockResolvedValue(0),
          organization: {
            findMany: vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'org-1',
              name: 'Personal Org',
              slug: 'personal-org',
            }),
          },
        };
        return callback(mockTx);
      }),
    },
  };
});
vi.mock('../utils/crypto', () => ({
  encrypt: vi.fn((token: string) => `encrypted_${token}`),
  decrypt: vi.fn((token: string) => token.replace('encrypted_', '')),
}));
vi.mock('../utils/refreshToken', () => ({
  createRefreshToken: vi.fn(async (userId: string) => `refresh_token_${userId}`),
  verifyAndRotateRefreshToken: vi.fn(async (token: string) => {
    if (token.startsWith('valid_')) {
      return token.replace('valid_', '');
    }
    return null;
  }),
}));
vi.mock('../utils/password', () => ({
  hashPassword: vi.fn(async (password: string) => `bcrypt_hashed_${password}`),
  verifyPassword: vi.fn(),
  isLegacyHash: vi.fn((hash: string) => /^[a-f0-9]{64}$/i.test(hash)),
}));

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let mockUserRepo: IUserRepository;
  let mockOrgService: OrganizationService;
  let mockPrisma: any;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    avatarUrl: 'https://avatar.url',
    githubId: '123456',
    githubAccessToken: 'encrypted_github_token',
    role: Role.MEMBER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGitHubUser = {
    id: 123456,
    login: 'testuser',
    avatar_url: 'https://avatar.url',
  };

  beforeEach(() => {
    mockUserRepo = {
      findById: vi.fn(),
      findByGithubId: vi.fn(),
      findByUsername: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    } as any;

    mockOrgService = {
      getUserOrganizations: vi.fn().mockResolvedValue([]),
      createOrganization: vi.fn().mockResolvedValue({ id: 'org-1' }),
    } as any;

    // Mock PrismaClient
    mockPrisma = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $transaction: vi.fn(async (callback) => {
        const mockTx = {
          $executeRaw: vi.fn().mockResolvedValue(0),
          organization: {
            findMany: vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'org-1',
              name: 'Personal Org',
              slug: 'personal-org',
            }),
          },
        };
        return callback(mockTx);
      }),
      refreshToken: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    service = new AuthenticationService(mockUserRepo, mockOrgService, mockPrisma);
    vi.clearAllMocks();
  });

  describe('authenticateLocal', () => {
    it('should authenticate user with correct password using bcrypt', async () => {
      const mockJwtSign = vi.fn((payload: any) => `jwt_${payload.id}`);
      const bcryptHash = '$2b$12$someHashValue';

      const adminUser = {
        ...mockUser,
        username: 'admin',
        password: bcryptHash,
        role: Role.ADMIN,
      };

      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(adminUser);
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);

      const result = await service.authenticateLocal('admin', 'correctPassword', mockJwtSign);

      expect(result).toEqual({
        user: {
          id: 'user-1',
          username: 'admin',
          avatarUrl: 'https://avatar.url',
          githubId: '123456',
          role: Role.ADMIN,
        },
        accessToken: 'jwt_user-1',
        refreshToken: 'refresh_token_user-1',
      });

      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('admin');
      expect(passwordUtils.verifyPassword).toHaveBeenCalledWith('correctPassword', bcryptHash);
      expect(mockUserRepo.update).not.toHaveBeenCalled(); // No migration needed
    });

    it('should reject authentication with incorrect password', async () => {
      const mockJwtSign = vi.fn();
      const bcryptHash = '$2b$12$someHashValue';

      const adminUser = {
        ...mockUser,
        username: 'admin',
        password: bcryptHash,
      };

      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(adminUser);
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(false);

      await expect(
        service.authenticateLocal('admin', 'wrongPassword', mockJwtSign),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject authentication if user does not exist', async () => {
      const mockJwtSign = vi.fn();

      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);

      await expect(
        service.authenticateLocal('nonexistent', 'password', mockJwtSign),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject authentication if user has no password', async () => {
      const mockJwtSign = vi.fn();

      const userWithoutPassword = {
        ...mockUser,
        password: null,
      };

      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(userWithoutPassword);

      await expect(service.authenticateLocal('user', 'password', mockJwtSign)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('should migrate legacy SHA-256 hash to bcrypt on successful login', async () => {
      const mockJwtSign = vi.fn((payload: any) => `jwt_${payload.id}`);
      const password = 'password123';
      const legacyHash = crypto.createHash('sha256').update(password).digest('hex');

      const adminUser = {
        ...mockUser,
        id: 'admin-1',
        username: 'admin',
        password: legacyHash,
        role: Role.ADMIN,
      };

      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(adminUser);
      vi.mocked(mockUserRepo.update).mockResolvedValue(adminUser);

      const result = await service.authenticateLocal('admin', password, mockJwtSign);

      // Should successfully authenticate
      expect(result).toEqual({
        user: {
          id: 'admin-1',
          username: 'admin',
          avatarUrl: 'https://avatar.url',
          githubId: '123456',
          role: Role.ADMIN,
        },
        accessToken: 'jwt_admin-1',
        refreshToken: 'refresh_token_admin-1',
      });

      // Should migrate password to bcrypt
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(password);
      expect(mockUserRepo.update).toHaveBeenCalledWith('admin-1', {
        password: 'bcrypt_hashed_password123',
      });
    });

    it('should reject legacy hash with incorrect password', async () => {
      const mockJwtSign = vi.fn();
      const correctPassword = 'password123';
      const wrongPassword = 'wrongpassword';
      const legacyHash = crypto.createHash('sha256').update(correctPassword).digest('hex');

      const adminUser = {
        ...mockUser,
        username: 'admin',
        password: legacyHash,
      };

      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(adminUser);

      await expect(service.authenticateLocal('admin', wrongPassword, mockJwtSign)).rejects.toThrow(
        UnauthorizedError,
      );

      // Should not attempt migration
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('authenticateWithGitHub', () => {
    it('should authenticate user with GitHub code', async () => {
      const mockJwtSign = vi.fn((payload: any) => `jwt_${payload.id}`);

      vi.mocked(axios.post).mockResolvedValue({
        data: { access_token: 'github_token', error: null },
      });
      vi.mocked(axios.get).mockResolvedValue({
        data: mockGitHubUser,
      });
      vi.mocked(mockUserRepo.upsert).mockResolvedValue(mockUser);

      const result = await service.authenticateWithGitHub('oauth_code', mockJwtSign);

      expect(result).toEqual({
        user: {
          id: 'user-1',
          username: 'testuser',
          avatarUrl: 'https://avatar.url',
          githubId: '123456',
          role: Role.MEMBER,
        },
        accessToken: 'jwt_user-1',
        refreshToken: 'refresh_token_user-1',
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          code: 'oauth_code',
        }),
        expect.any(Object),
      );
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: { Authorization: 'token github_token' },
        }),
      );
      expect(mockUserRepo.upsert).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError if code is missing', async () => {
      const mockJwtSign = vi.fn();

      await expect(service.authenticateWithGitHub('', mockJwtSign)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('should throw UnauthorizedError if GitHub returns error', async () => {
      const mockJwtSign = vi.fn();

      vi.mocked(axios.post).mockResolvedValue({
        data: { error: 'invalid_grant' },
      });

      await expect(service.authenticateWithGitHub('invalid_code', mockJwtSign)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('should throw UnauthorizedError if access token is missing', async () => {
      const mockJwtSign = vi.fn();

      vi.mocked(axios.post).mockResolvedValue({
        data: { error: null },
      });

      await expect(service.authenticateWithGitHub('oauth_code', mockJwtSign)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('should throw UnauthorizedError if fetching user fails', async () => {
      const mockJwtSign = vi.fn();

      vi.mocked(axios.post).mockResolvedValue({
        data: { access_token: 'github_token', error: null },
      });
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

      await expect(service.authenticateWithGitHub('oauth_code', mockJwtSign)).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should throw UnauthorizedError if refresh token is missing', async () => {
      const mockJwtSign = vi.fn();

      await expect(service.refreshAccessToken('', mockJwtSign)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);

      const result = await service.getUserById('user-1');

      expect(result).toEqual({
        id: 'user-1',
        username: 'testuser',
        avatarUrl: 'https://avatar.url',
        githubId: '123456',
        role: Role.MEMBER,
      });
      expect(mockUserRepo.findById).toHaveBeenCalledWith('user-1');
    });

    it('should throw UnauthorizedError if user is not found', async () => {
      vi.mocked(mockUserRepo.findById).mockResolvedValue(null);

      await expect(service.getUserById('user-1')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('disconnectGitHub', () => {
    it('should disconnect GitHub account', async () => {
      const userWithEmailAuth = {
        ...mockUser,
        email: 'test@example.com',
        password: 'hashed_password',
      };
      vi.mocked(mockUserRepo.findById).mockResolvedValue(userWithEmailAuth);
      vi.mocked(mockUserRepo.update).mockResolvedValue({
        ...userWithEmailAuth,
        githubAccessToken: null,
        githubId: null,
      });

      await service.disconnectGitHub('user-1');

      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        githubAccessToken: null,
        githubId: null,
      });
    });

    it('should throw UnauthorizedError if user does not have email/password auth', async () => {
      const userWithoutEmailAuth = {
        ...mockUser,
        email: null,
        password: null,
      };
      vi.mocked(mockUserRepo.findById).mockResolvedValue(userWithoutEmailAuth);

      await expect(service.disconnectGitHub('user-1')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if user is not found', async () => {
      vi.mocked(mockUserRepo.findById).mockResolvedValue(null);

      await expect(service.disconnectGitHub('user-1')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('getGitHubAccessToken', () => {
    it('should return decrypted GitHub access token', async () => {
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);

      const result = await service.getGitHubAccessToken('user-1');

      expect(result).toBe('github_token');
    });

    it('should return null if user is not found', async () => {
      vi.mocked(mockUserRepo.findById).mockResolvedValue(null);

      const result = await service.getGitHubAccessToken('user-1');

      expect(result).toBeNull();
    });

    it('should return null if user has no GitHub token', async () => {
      vi.mocked(mockUserRepo.findById).mockResolvedValue({
        ...mockUser,
        githubAccessToken: null,
      });

      const result = await service.getGitHubAccessToken('user-1');

      expect(result).toBeNull();
    });
  });

  describe('registerWithEmail', () => {
    it('should register user with valid inputs', async () => {
      const mockJwtSign = vi.fn().mockReturnValue('jwt_token');
      const email = 'test@example.com';
      const password = 'password123';
      const username = 'testuser';

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepo.create).mockResolvedValue({
        id: 'user-1',
        username,
        email,
        avatarUrl: null,
        githubId: null,
        githubAccessToken: null,
        password: 'bcrypt_hashed_password123',
        role: Role.MEMBER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.registerWithEmail(email, password, username, mockJwtSign);

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(email);
      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith(username);
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(password);
      expect(mockUserRepo.create).toHaveBeenCalled();
      expect(mockJwtSign).toHaveBeenCalled();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken', 'jwt_token');
      expect(result).toHaveProperty('refreshToken', 'refresh_token_user-1');
    });

    it('should reject when email is already registered', async () => {
      const mockJwtSign = vi.fn();
      const email = 'existing@example.com';
      const password = 'password123';
      const username = 'testuser';

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);

      await expect(
        service.registerWithEmail(email, password, username, mockJwtSign),
      ).rejects.toThrow('Email already registered');
    });

    it('should reject when username is already taken', async () => {
      const mockJwtSign = vi.fn();
      const email = 'test@example.com';
      const password = 'password123';
      const username = 'existinguser';

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(mockUser);

      await expect(
        service.registerWithEmail(email, password, username, mockJwtSign),
      ).rejects.toThrow('Username already taken');
    });

    it('should hash password before storing', async () => {
      const mockJwtSign = vi.fn().mockReturnValue('jwt_token');
      const email = 'test@example.com';
      const password = 'mypassword';
      const username = 'testuser';

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepo.create).mockResolvedValue({
        id: 'user-1',
        username,
        email,
        avatarUrl: null,
        githubId: null,
        githubAccessToken: null,
        password: 'bcrypt_hashed_mypassword',
        role: Role.MEMBER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.registerWithEmail(email, password, username, mockJwtSign);

      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(password);
      const createCall = vi.mocked(mockUserRepo.create).mock.calls[0][0];
      expect(createCall).toHaveProperty('password', 'bcrypt_hashed_mypassword');
    });
  });

  describe('authenticateWithEmail', () => {
    it('should authenticate user with valid credentials', async () => {
      const mockJwtSign = vi.fn().mockReturnValue('jwt_token');
      const email = 'test@example.com';
      const password = 'password123';

      const userWithEmail = {
        ...mockUser,
        email,
        password: 'bcrypt_hashed_password123',
      };

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(userWithEmail);
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(true);
      vi.mocked(passwordUtils.isLegacyHash).mockReturnValue(false);

      const result = await service.authenticateWithEmail(email, password, mockJwtSign);

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(email);
      expect(passwordUtils.verifyPassword).toHaveBeenCalledWith(password, userWithEmail.password);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken', 'jwt_token');
      expect(result).toHaveProperty('refreshToken', 'refresh_token_user-1');
    });

    it('should reject when email does not exist', async () => {
      const mockJwtSign = vi.fn();
      const email = 'nonexistent@example.com';
      const password = 'password123';

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);

      await expect(service.authenticateWithEmail(email, password, mockJwtSign)).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('should reject when password is incorrect', async () => {
      const mockJwtSign = vi.fn();
      const email = 'test@example.com';
      const password = 'wrongpassword';

      const userWithEmail = {
        ...mockUser,
        email,
        password: 'bcrypt_hashed_correctpassword',
      };

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(userWithEmail);
      vi.mocked(passwordUtils.verifyPassword).mockResolvedValue(false);
      vi.mocked(passwordUtils.isLegacyHash).mockReturnValue(false);

      await expect(service.authenticateWithEmail(email, password, mockJwtSign)).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('should migrate legacy password on successful login', async () => {
      const mockJwtSign = vi.fn().mockReturnValue('jwt_token');
      const email = 'test@example.com';
      const password = 'password123';
      const legacyHash = crypto.createHash('sha256').update(password).digest('hex');

      const userWithEmail = {
        ...mockUser,
        email,
        password: legacyHash,
      };

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(userWithEmail);
      vi.mocked(passwordUtils.isLegacyHash).mockReturnValue(true);

      await service.authenticateWithEmail(email, password, mockJwtSign);

      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(password);
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        password: 'bcrypt_hashed_password123',
      });
    });

    it('should reject when user has no password', async () => {
      const mockJwtSign = vi.fn();
      const email = 'test@example.com';
      const password = 'password123';

      const userWithEmail = {
        ...mockUser,
        email,
        password: null,
      };

      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(userWithEmail);

      await expect(service.authenticateWithEmail(email, password, mockJwtSign)).rejects.toThrow(
        'Invalid email or password',
      );
    });
  });

  describe('linkGitHubAccount', () => {
    it('should successfully link GitHub account', async () => {
      const userId = 'user-1';
      const code = 'github_auth_code';
      const accessToken = 'github_access_token';

      const userWithoutGithub = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed_password',
        avatarUrl: null,
        githubId: null,
        githubAccessToken: null,
        role: Role.MEMBER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockUserRepo.findById).mockResolvedValue(userWithoutGithub);
      vi.mocked(mockUserRepo.findByGithubId).mockResolvedValue(null);
      vi.mocked(axios.post).mockResolvedValue({
        data: { access_token: accessToken },
      });
      vi.mocked(axios.get).mockResolvedValue({
        data: mockGitHubUser,
      });

      const result = await service.linkGitHubAccount(userId, code);

      expect(result.success).toBe(true);
      expect(mockUserRepo.update).toHaveBeenCalledWith(userId, {
        githubId: '123456',
        githubAccessToken: `encrypted_${accessToken}`,
        avatarUrl: mockGitHubUser.avatar_url,
      });
    });

    it('should reject when user not found', async () => {
      const userId = 'nonexistent';
      const code = 'github_auth_code';

      vi.mocked(mockUserRepo.findById).mockResolvedValue(null);

      await expect(service.linkGitHubAccount(userId, code)).rejects.toThrow('User not found');
    });

    it('should reject when GitHub account already linked to this user', async () => {
      const userId = 'user-1';
      const code = 'github_auth_code';

      const userWithGithub = {
        ...mockUser,
        email: 'test@example.com',
      };

      vi.mocked(mockUserRepo.findById).mockResolvedValue(userWithGithub);

      await expect(service.linkGitHubAccount(userId, code)).rejects.toThrow(
        'GitHub account already linked',
      );
    });

    it('should reject when GitHub account already linked to another user', async () => {
      const userId = 'user-1';
      const code = 'github_auth_code';
      const accessToken = 'github_access_token';

      const userWithoutGithub = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed_password',
        avatarUrl: null,
        githubId: null,
        githubAccessToken: null,
        role: Role.MEMBER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const otherUserWithGithub = {
        id: 'other-user',
        username: 'otheruser',
        email: 'other@example.com',
        password: null,
        avatarUrl: null,
        githubId: '123456',
        githubAccessToken: 'encrypted_token',
        role: Role.MEMBER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockUserRepo.findById).mockResolvedValue(userWithoutGithub);
      vi.mocked(mockUserRepo.findByGithubId).mockResolvedValue(otherUserWithGithub);
      vi.mocked(axios.post).mockResolvedValue({
        data: { access_token: accessToken },
      });
      vi.mocked(axios.get).mockResolvedValue({
        data: mockGitHubUser,
      });

      await expect(service.linkGitHubAccount(userId, code)).rejects.toThrow(
        'This GitHub account is already linked to another user',
      );
    });
  });
});
