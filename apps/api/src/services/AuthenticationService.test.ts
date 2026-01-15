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
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    } as any;

    mockOrgService = {
      getUserOrganizations: vi.fn().mockResolvedValue([]),
      createOrganization: vi.fn().mockResolvedValue({ id: 'org-1' }),
    } as any;

    service = new AuthenticationService(mockUserRepo, mockOrgService);
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
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(mockUserRepo.update).mockResolvedValue({ ...mockUser, githubAccessToken: null });

      await service.disconnectGitHub('user-1');

      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        githubAccessToken: null,
      });
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
});
