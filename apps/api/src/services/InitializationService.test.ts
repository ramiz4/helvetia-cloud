import crypto from 'crypto';
import { Role } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env';
import type { IFeatureFlagRepository, IUserRepository } from '../interfaces';
import { InitializationService } from './InitializationService';

vi.mock('../config/env', () => ({
  env: {
    HELVETIA_ADMIN: 'admin',
    HELVETIA_ADMIN_PASSWORD: 'password123',
  },
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

      const expectedHashedPassword = crypto
        .createHash('sha256')
        .update('password123')
        .digest('hex');

      expect(mockUserRepo.findByGithubId).toHaveBeenCalledWith('local-admin');
      expect(mockUserRepo.upsert).toHaveBeenCalledWith(
        { githubId: 'local-admin' },
        {
          githubId: 'local-admin',
          username: 'admin',
          password: expectedHashedPassword,
          role: Role.ADMIN,
        },
        {
          username: 'admin',
          password: expectedHashedPassword,
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

      const expectedHashedPassword = crypto
        .createHash('sha256')
        .update('password123')
        .digest('hex');

      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        username: 'admin',
        password: expectedHashedPassword,
        role: Role.ADMIN,
      });
    });

    it('should not update admin user if details are same', async () => {
      const expectedHashedPassword = crypto
        .createHash('sha256')
        .update('password123')
        .digest('hex');
      const existingAdmin = {
        id: 'user-1',
        githubId: 'local-admin',
        username: 'admin',
        password: expectedHashedPassword,
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
  });

  describe('password hashing', () => {
    it('should hash password correctly using SHA256', async () => {
      // Since hashPassword is private, we test it through the initialize method
      // which uses it to set the password in the repository call
      vi.mocked(mockUserRepo.findByGithubId).mockResolvedValue(null);
      vi.mocked(mockFeatureFlagRepo.findByKey).mockResolvedValue({} as any);

      const password = 'my-secret-password';
      const expectedHash = crypto.createHash('sha256').update(password).digest('hex');

      const originalPassword = env.HELVETIA_ADMIN_PASSWORD;
      (env as any).HELVETIA_ADMIN_PASSWORD = password;

      await service.initialize();

      expect(mockUserRepo.upsert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ password: expectedHash }),
        expect.objectContaining({ password: expectedHash }),
      );

      (env as any).HELVETIA_ADMIN_PASSWORD = originalPassword;
    });
  });
});
