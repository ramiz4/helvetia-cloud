import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IFeatureFlagRepository } from '../interfaces';
import { FeatureFlagService } from './FeatureFlagService';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let mockRepository: IFeatureFlagRepository;

  const mockFlag = {
    id: 'flag-1',
    key: 'test_feature',
    name: 'Test Feature',
    description: 'A test feature flag',
    enabled: true,
    segments: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      findByKey: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      isEnabled: vi.fn(),
    };

    service = new FeatureFlagService(mockRepository);
  });

  describe('getAllFlags', () => {
    it('should return all feature flags', async () => {
      const flags = [mockFlag];
      vi.mocked(mockRepository.findAll).mockResolvedValue(flags);

      const result = await service.getAllFlags();

      expect(result).toEqual(flags);
      expect(mockRepository.findAll).toHaveBeenCalledOnce();
    });
  });

  describe('getFlagById', () => {
    it('should return a flag by ID', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockFlag);

      const result = await service.getFlagById('flag-1');

      expect(result).toEqual(mockFlag);
      expect(mockRepository.findById).toHaveBeenCalledWith('flag-1');
    });

    it('should return null if flag not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await service.getFlagById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getFlagByKey', () => {
    it('should return a flag by key', async () => {
      vi.mocked(mockRepository.findByKey).mockResolvedValue(mockFlag);

      const result = await service.getFlagByKey('test_feature');

      expect(result).toEqual(mockFlag);
      expect(mockRepository.findByKey).toHaveBeenCalledWith('test_feature');
    });
  });

  describe('createFlag', () => {
    it('should create a new feature flag', async () => {
      const createData = {
        key: 'new_feature',
        name: 'New Feature',
        description: 'A new feature',
        enabled: false,
      };

      vi.mocked(mockRepository.findByKey).mockResolvedValue(null);
      vi.mocked(mockRepository.create).mockResolvedValue({
        ...mockFlag,
        ...createData,
        id: 'new-flag-id',
      });

      const result = await service.createFlag(createData);

      expect(result.key).toBe('new_feature');
      expect(mockRepository.findByKey).toHaveBeenCalledWith('new_feature');
      expect(mockRepository.create).toHaveBeenCalledWith(createData);
    });

    it('should throw error if flag key already exists', async () => {
      const createData = {
        key: 'test_feature',
        name: 'Test Feature',
      };

      vi.mocked(mockRepository.findByKey).mockResolvedValue(mockFlag);

      await expect(service.createFlag(createData)).rejects.toThrow(
        'Feature flag with key "test_feature" already exists',
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateFlag', () => {
    it('should update an existing feature flag', async () => {
      const updateData = {
        name: 'Updated Feature',
        enabled: false,
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(mockFlag);
      vi.mocked(mockRepository.update).mockResolvedValue({
        ...mockFlag,
        ...updateData,
      });

      const result = await service.updateFlag('flag-1', updateData);

      expect(result.name).toBe('Updated Feature');
      expect(result.enabled).toBe(false);
      expect(mockRepository.update).toHaveBeenCalledWith('flag-1', updateData);
    });

    it('should throw error if flag not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(service.updateFlag('nonexistent', { name: 'Test' })).rejects.toThrow(
        'Feature flag with id "nonexistent" not found',
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteFlag', () => {
    it('should delete a feature flag', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockFlag);
      vi.mocked(mockRepository.delete).mockResolvedValue(undefined);

      await service.deleteFlag('flag-1');

      expect(mockRepository.delete).toHaveBeenCalledWith('flag-1');
    });

    it('should throw error if flag not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(service.deleteFlag('nonexistent')).rejects.toThrow(
        'Feature flag with id "nonexistent" not found',
      );
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('isEnabled', () => {
    it('should check if flag is enabled', async () => {
      vi.mocked(mockRepository.isEnabled).mockResolvedValue(true);

      const result = await service.isEnabled('test_feature');

      expect(result).toBe(true);
      expect(mockRepository.isEnabled).toHaveBeenCalledWith('test_feature', undefined);
    });

    it('should check if flag is enabled for specific user', async () => {
      vi.mocked(mockRepository.isEnabled).mockResolvedValue(true);

      const result = await service.isEnabled('test_feature', 'user-123');

      expect(result).toBe(true);
      expect(mockRepository.isEnabled).toHaveBeenCalledWith('test_feature', 'user-123');
    });

    it('should return false for non-existent flag', async () => {
      vi.mocked(mockRepository.isEnabled).mockResolvedValue(false);

      const result = await service.isEnabled('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('checkMultiple', () => {
    it('should check multiple flags at once', async () => {
      vi.mocked(mockRepository.isEnabled)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await service.checkMultiple(['flag1', 'flag2', 'flag3']);

      expect(result).toEqual({
        flag1: true,
        flag2: false,
        flag3: true,
      });
      expect(mockRepository.isEnabled).toHaveBeenCalledTimes(3);
    });

    it('should check multiple flags for specific user', async () => {
      vi.mocked(mockRepository.isEnabled).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const result = await service.checkMultiple(['flag1', 'flag2'], 'user-123');

      expect(result).toEqual({
        flag1: true,
        flag2: false,
      });
      expect(mockRepository.isEnabled).toHaveBeenCalledWith('flag1', 'user-123');
      expect(mockRepository.isEnabled).toHaveBeenCalledWith('flag2', 'user-123');
    });

    it('should return false for all non-existent flags', async () => {
      vi.mocked(mockRepository.isEnabled).mockResolvedValue(false);

      const result = await service.checkMultiple(['nonexistent1', 'nonexistent2']);

      expect(result).toEqual({
        nonexistent1: false,
        nonexistent2: false,
      });
    });
  });

  describe('toggleFlag', () => {
    it('should toggle flag from enabled to disabled', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockFlag);
      vi.mocked(mockRepository.update).mockResolvedValue({
        ...mockFlag,
        enabled: false,
      });

      const result = await service.toggleFlag('flag-1');

      expect(result.enabled).toBe(false);
      expect(mockRepository.update).toHaveBeenCalledWith('flag-1', { enabled: false });
    });

    it('should toggle flag from disabled to enabled', async () => {
      const disabledFlag = { ...mockFlag, enabled: false };
      vi.mocked(mockRepository.findById).mockResolvedValue(disabledFlag);
      vi.mocked(mockRepository.update).mockResolvedValue({
        ...disabledFlag,
        enabled: true,
      });

      const result = await service.toggleFlag('flag-1');

      expect(result.enabled).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith('flag-1', { enabled: true });
    });

    it('should throw error if flag not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(service.toggleFlag('nonexistent')).rejects.toThrow(
        'Feature flag with id "nonexistent" not found',
      );
    });
  });
});
