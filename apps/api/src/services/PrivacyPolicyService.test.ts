import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPrivacyPolicyRepository } from '../interfaces';
import { PrivacyPolicyService } from './PrivacyPolicyService';

// Mock path and fs/promises
vi.mock('path', () => {
  return {
    default: {
      join: vi.fn((...args) => args.join('/')),
    },
    join: vi.fn((...args) => args.join('/')),
  };
});
vi.mock('fs/promises', () => {
  return {
    readFile: vi.fn(),
  };
});

import * as fs from 'fs/promises';

describe('PrivacyPolicyService', () => {
  let service: PrivacyPolicyService;
  let mockPrivacyRepo: IPrivacyPolicyRepository;

  const mockPolicy = {
    id: 'policy-1',
    version: '1.0.0',
    content: 'Privacy Policy Content',
    language: 'en',
    effectiveAt: new Date('2025-01-01T00:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAcceptance = {
    id: 'acceptance-1',
    userId: 'user-1',
    privacyPolicyVersionId: 'policy-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    acceptedAt: new Date(),
    user: {} as any,
    privacyPolicy: mockPolicy,
  };

  beforeEach(() => {
    mockPrivacyRepo = {
      findLatestVersion: vi.fn(),
      findByVersion: vi.fn(),
      findAllVersions: vi.fn(),
      createVersion: vi.fn(),
      getUserAcceptance: vi.fn(),
      getUserLatestAcceptance: vi.fn(),
      createAcceptance: vi.fn(),
      hasUserAcceptedVersion: vi.fn(),
    };

    service = new PrivacyPolicyService(mockPrivacyRepo);
    vi.clearAllMocks();
  });

  describe('getLatestPrivacyPolicy', () => {
    it('should return the latest policy', async () => {
      vi.mocked(mockPrivacyRepo.findLatestVersion).mockResolvedValue(mockPolicy);
      const result = await service.getLatestPrivacyPolicy('en');
      expect(result).toEqual(mockPolicy);
      expect(mockPrivacyRepo.findLatestVersion).toHaveBeenCalledWith('en');
    });

    it('should return null if no policy found', async () => {
      vi.mocked(mockPrivacyRepo.findLatestVersion).mockResolvedValue(null);
      const result = await service.getLatestPrivacyPolicy('en');
      expect(result).toBeNull();
    });
  });

  describe('getPrivacyPolicyByVersion', () => {
    it('should return policy by version', async () => {
      vi.mocked(mockPrivacyRepo.findByVersion).mockResolvedValue(mockPolicy);
      const result = await service.getPrivacyPolicyByVersion('1.0.0', 'en');
      expect(result).toEqual(mockPolicy);
      expect(mockPrivacyRepo.findByVersion).toHaveBeenCalledWith('1.0.0', 'en');
    });
  });

  describe('createPrivacyPolicyVersion', () => {
    it('should create a new version', async () => {
      vi.mocked(mockPrivacyRepo.findByVersion).mockResolvedValue(null);
      vi.mocked(mockPrivacyRepo.createVersion).mockResolvedValue(mockPolicy);

      const data = {
        version: '1.0.0',
        content: 'content',
        language: 'en',
        effectiveAt: new Date(),
      };

      const result = await service.createPrivacyPolicyVersion(data);
      expect(result).toEqual(mockPolicy);
      expect(mockPrivacyRepo.createVersion).toHaveBeenCalledWith(data);
    });

    it('should throw if version already exists', async () => {
      vi.mocked(mockPrivacyRepo.findByVersion).mockResolvedValue(mockPolicy);
      const data = {
        version: '1.0.0',
        content: 'content',
        language: 'en',
        effectiveAt: new Date(),
      };

      await expect(service.createPrivacyPolicyVersion(data)).rejects.toThrow();
    });
  });

  describe('acceptPrivacyPolicy', () => {
    it('should record acceptance', async () => {
      vi.mocked(mockPrivacyRepo.getUserAcceptance).mockResolvedValue(null);
      vi.mocked(mockPrivacyRepo.createAcceptance).mockResolvedValue(mockAcceptance);

      const data = {
        userId: 'user-1',
        privacyPolicyVersionId: 'policy-1',
        ipAddress: '127.0.0.1',
        userAgent: 'agent',
      };

      const result = await service.acceptPrivacyPolicy(data);
      expect(result).toEqual(mockAcceptance);
      expect(mockPrivacyRepo.createAcceptance).toHaveBeenCalledWith(data);
    });

    it('should return existing acceptance if already accepted', async () => {
      vi.mocked(mockPrivacyRepo.getUserAcceptance).mockResolvedValue(mockAcceptance);

      const data = {
        userId: 'user-1',
        privacyPolicyVersionId: 'policy-1',
      };

      const result = await service.acceptPrivacyPolicy(data);
      expect(result).toEqual(mockAcceptance);
      expect(mockPrivacyRepo.createAcceptance).not.toHaveBeenCalled();
    });
  });

  describe('requiresAcceptance', () => {
    it('should return false if no policy exists', async () => {
      vi.mocked(mockPrivacyRepo.findLatestVersion).mockResolvedValue(null);
      const result = await service.requiresAcceptance('user-1', 'en');
      expect(result).toBe(false);
    });

    it('should return true if policy exists but user has not accepted anything', async () => {
      vi.mocked(mockPrivacyRepo.findLatestVersion).mockResolvedValue(mockPolicy);
      vi.mocked(mockPrivacyRepo.getUserLatestAcceptance).mockResolvedValue(null);
      const result = await service.requiresAcceptance('user-1', 'en');
      expect(result).toBe(true);
    });

    it('should return true if user accepted older version', async () => {
      const oldAcceptance = {
        ...mockAcceptance,
        privacyPolicy: {
          ...mockPolicy,
          effectiveAt: new Date('2020-01-01'),
        },
      } as any;
      const newPolicy = {
        ...mockPolicy,
        effectiveAt: new Date('2025-01-01'),
      };

      vi.mocked(mockPrivacyRepo.findLatestVersion).mockResolvedValue(newPolicy);
      vi.mocked(mockPrivacyRepo.getUserLatestAcceptance).mockResolvedValue(oldAcceptance);

      const result = await service.requiresAcceptance('user-1', 'en');
      expect(result).toBe(true);
    });

    it('should return false if user accepted latest version', async () => {
      const acceptance = { ...mockAcceptance, privacyPolicy: mockPolicy } as any;

      vi.mocked(mockPrivacyRepo.findLatestVersion).mockResolvedValue(mockPolicy);
      vi.mocked(mockPrivacyRepo.getUserLatestAcceptance).mockResolvedValue(acceptance);

      const result = await service.requiresAcceptance('user-1', 'en');
      expect(result).toBe(false);
    });
  });

  describe('initializePrivacyPolicyFromFiles', () => {
    it('should initialize policies', async () => {
      vi.mocked(mockPrivacyRepo.findByVersion).mockResolvedValue(null);
      vi.mocked(fs.readFile).mockResolvedValue('content');

      // Mock createVersion to return promise
      vi.mocked(mockPrivacyRepo.createVersion).mockResolvedValue(mockPolicy);

      await service.initializePrivacyPolicyFromFiles('1.0.0', new Date());

      const languages = ['en', 'de', 'fr', 'it', 'gsw'];
      expect(mockPrivacyRepo.createVersion).toHaveBeenCalledTimes(languages.length);
    });
  });
});
