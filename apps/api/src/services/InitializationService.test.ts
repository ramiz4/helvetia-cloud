import crypto from 'crypto';
import { Role } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env';
import type { IFeatureFlagRepository, IUserRepository } from '../interfaces';
import * as passwordUtils from '../utils/password';
import { InitializationService } from './InitializationService';

vi.mock('../config/env', () => ({
  env: {
    HELVETIA_ADMIN: 'admin',
    HELVETIA_ADMIN_PASSWORD: 'password123',
  },
}));

vi.mock('../utils/password', () => ({
  hashPassword: vi.fn(async (password: string) => `bcrypt_hashed_${password}`),
  isLegacyHash: vi.fn((hash: string) => /^[a-f0-9]{64}$/i.test(hash)),
  verifyPassword: vi.fn(),
}));

describe('InitializationService', () => {
  let service: InitializationService;
  let mockUserRepo: IUserRepository;
  let mockFeatureFlagRepo: IFeatureFlagRepository;

  beforeEach(() => {
    mockUserRepo = {
      findByGithubId: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    } as any;

    mockFeatureFlagRepo = {
      findByKey: vi.fn(),
      create: vi.fn(),
    } as any;

    service = new InitializationService(mockUserRepo, mockFeatureFlagRepo);
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('initialize', () => {
    it('should create admin user if it does not exist', async () => {
      vi.mocked(mockUserRepo.findByGithubId).mockResolvedValue(null);
      vi.mocked(mockFeatureFlagRepo.findByKey).mockResolvedValue(null);

      await service.initialize();

      expect(mockUserRepo.findByGithubId).toHaveBeenCalledWith('local-admin');
      expect(mockUserRepo.upsert).toHaveBeenCalledWith(
        { githubId: 'local-admin' },
        {
          githubId: 'local-admin',
          username: 'admin',
          password: 'bcrypt_hashed_password123',
          role: Role.ADMIN,
        },
        {
          username: 'admin',
          password: 'bcrypt_hashed_password123',
          role: Role.ADMIN,
        },
      );

      expect(mockFeatureFlagRepo.findByKey).toHaveBeenCalledWith('show-deployments');
      expect(mockFeatureFlagRepo.create).toHaveBeenCalledWith({
        key: 'show-deployments',
        name: 'Show Deployments',
        description: 'Enable the deployments view in the dashboard',
        enabled: true,
      });
    });

    it('should update admin user if details changed', async () => {
      const existingAdmin = {
        id: 'user-1',
        githubId: 'local-admin',
        username: 'old-admin',
        password: 'old-password',
        role: Role.MEMBER,
      };
      vi.mocked(mockUserRepo.findByGithubId).mockResolvedValue(existingAdmin as any);
      vi.mocked(mockFeatureFlagRepo.findByKey).mockResolvedValue({} as any);

      await service.initialize();

      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        username: 'admin',
        password: 'bcrypt_hashed_password123',
        role: Role.ADMIN,
      });
    });

    it('should not update admin user if details are same', async () => {
      const existingAdmin = {
        id: 'user-1',
        githubId: 'local-admin',
        username: 'admin',
        password: 'bcrypt_hashed_password123',
        role: Role.ADMIN,
      };
      vi.mocked(mockUserRepo.findByGithubId).mockResolvedValue(existingAdmin as any);
      vi.mocked(mockFeatureFlagRepo.findByKey).mockResolvedValue({} as any);

      await service.initialize();

      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it('should return early if admin username is missing', async () => {
      const originalAdmin = env.HELVETIA_ADMIN;
      (env as any).HELVETIA_ADMIN = undefined;

      await service.initialize();

      expect(mockUserRepo.findByGithubId).not.toHaveBeenCalled();

      (env as any).HELVETIA_ADMIN = originalAdmin;
    });

    it('should return early if admin password is missing', async () => {
      const originalPassword = env.HELVETIA_ADMIN_PASSWORD;
      (env as any).HELVETIA_ADMIN_PASSWORD = undefined;

      await service.initialize();

      expect(mockUserRepo.findByGithubId).not.toHaveBeenCalled();

      (env as any).HELVETIA_ADMIN_PASSWORD = originalPassword;
    });

    it('should handle errors gracefully during initialization', async () => {
      vi.mocked(mockUserRepo.findByGithubId).mockRejectedValue(new Error('DB Error'));
      vi.mocked(mockFeatureFlagRepo.findByKey).mockResolvedValue({} as any);

      await service.initialize();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to initialize admin user:',
        expect.any(Error),
      );
    });

    it('should migrate legacy SHA-256 hash to bcrypt on initialization', async () => {
      // SHA-256 hash of 'password123'
      const legacyHash = crypto.createHash('sha256').update('password123').digest('hex');

      const existingAdmin = {
        id: 'user-1',
        githubId: 'local-admin',
        username: 'admin',
        password: legacyHash,
        role: Role.ADMIN,
      };
      vi.mocked(mockUserRepo.findByGithubId).mockResolvedValue(existingAdmin as any);
      vi.mocked(mockFeatureFlagRepo.findByKey).mockResolvedValue({} as any);

      await service.initialize();

      // Should update with new bcrypt hash
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        username: 'admin',
        password: 'bcrypt_hashed_password123',
        role: Role.ADMIN,
      });
    });
  });

  describe('password hashing', () => {
    it('should use bcrypt for password hashing', async () => {
      vi.mocked(mockUserRepo.findByGithubId).mockResolvedValue(null);
      vi.mocked(mockFeatureFlagRepo.findByKey).mockResolvedValue({} as any);

      const password = 'my-secret-password';
      const originalPassword = env.HELVETIA_ADMIN_PASSWORD;
      (env as any).HELVETIA_ADMIN_PASSWORD = password;

      await service.initialize();

      // Verify hashPassword was called with the correct password
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith(password);

      expect(mockUserRepo.upsert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ password: `bcrypt_hashed_${password}` }),
        expect.objectContaining({ password: `bcrypt_hashed_${password}` }),
      );

      (env as any).HELVETIA_ADMIN_PASSWORD = originalPassword;
    });
  });
});
