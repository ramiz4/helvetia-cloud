import { Prisma } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaFeatureFlagRepository } from './PrismaFeatureFlagRepository';

// Mock PrismaClient
const mockPrismaClient = {
  featureFlag: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

describe('PrismaFeatureFlagRepository', () => {
  let repository: PrismaFeatureFlagRepository;

  const mockFlag = {
    id: 'flag-1',
    key: 'test_feature',
    name: 'Test Feature',
    description: 'A test feature',
    enabled: true,
    segments: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - Mocking PrismaClient
    repository = new PrismaFeatureFlagRepository(mockPrismaClient);
  });

  describe('findById', () => {
    it('should find a flag by ID', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue(mockFlag);

      const result = await repository.findById('flag-1');

      expect(result).toEqual(mockFlag);
      expect(mockPrismaClient.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { id: 'flag-1' },
      });
    });

    it('should return null if flag not found', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByKey', () => {
    it('should find a flag by key', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue(mockFlag);

      const result = await repository.findByKey('test_feature');

      expect(result).toEqual(mockFlag);
      expect(mockPrismaClient.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { key: 'test_feature' },
      });
    });
  });

  describe('findAll', () => {
    it('should return all flags ordered by creation date', async () => {
      const flags = [mockFlag, { ...mockFlag, id: 'flag-2', key: 'another_feature' }];
      mockPrismaClient.featureFlag.findMany.mockResolvedValue(flags);

      const result = await repository.findAll();

      expect(result).toEqual(flags);
      expect(mockPrismaClient.featureFlag.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('should create a new flag', async () => {
      const createData = {
        key: 'new_feature',
        name: 'New Feature',
        description: 'A new feature',
        enabled: false,
      };

      mockPrismaClient.featureFlag.create.mockResolvedValue({
        ...mockFlag,
        ...createData,
        id: 'new-flag-id',
      });

      const result = await repository.create(createData);

      expect(result.key).toBe('new_feature');
      expect(mockPrismaClient.featureFlag.create).toHaveBeenCalledWith({
        data: {
          key: createData.key,
          name: createData.name,
          description: createData.description,
          enabled: createData.enabled,
          segments: Prisma.JsonNull,
        },
      });
    });

    it('should create a flag with segments', async () => {
      const createData = {
        key: 'ab_test_feature',
        name: 'A/B Test Feature',
        segments: {
          type: 'percentage' as const,
          percentage: 50,
        },
      };

      mockPrismaClient.featureFlag.create.mockResolvedValue({
        ...mockFlag,
        ...createData,
        id: 'ab-flag-id',
      });

      await repository.create(createData);

      expect(mockPrismaClient.featureFlag.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          segments: createData.segments,
        }),
      });
    });
  });

  describe('update', () => {
    it('should update a flag', async () => {
      const updateData = {
        name: 'Updated Feature',
        enabled: false,
      };

      mockPrismaClient.featureFlag.update.mockResolvedValue({
        ...mockFlag,
        ...updateData,
      });

      const result = await repository.update('flag-1', updateData);

      expect(result.name).toBe('Updated Feature');
      expect(result.enabled).toBe(false);
      expect(mockPrismaClient.featureFlag.update).toHaveBeenCalledWith({
        where: { id: 'flag-1' },
        data: updateData,
      });
    });
  });

  describe('delete', () => {
    it('should delete a flag', async () => {
      mockPrismaClient.featureFlag.delete.mockResolvedValue(mockFlag);

      await repository.delete('flag-1');

      expect(mockPrismaClient.featureFlag.delete).toHaveBeenCalledWith({
        where: { id: 'flag-1' },
      });
    });
  });

  describe('isEnabled', () => {
    it('should return false for non-existent flag', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue(null);

      const result = await repository.isEnabled('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false for disabled flag', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
        ...mockFlag,
        enabled: false,
      });

      const result = await repository.isEnabled('test_feature');

      expect(result).toBe(false);
    });

    it('should return true for enabled flag without segments', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue(mockFlag);

      const result = await repository.isEnabled('test_feature');

      expect(result).toBe(true);
    });

    it('should return true for user in userIds segment', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
        ...mockFlag,
        segments: {
          type: 'userIds',
          userIds: ['user-1', 'user-2', 'user-3'],
        },
      });

      const result = await repository.isEnabled('test_feature', 'user-2');

      expect(result).toBe(true);
    });

    it('should return false for user not in userIds segment', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
        ...mockFlag,
        segments: {
          type: 'userIds',
          userIds: ['user-1', 'user-2', 'user-3'],
        },
      });

      const result = await repository.isEnabled('test_feature', 'user-999');

      expect(result).toBe(false);
    });

    it('should use deterministic hashing for percentage rollout', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
        ...mockFlag,
        segments: {
          type: 'percentage',
          percentage: 50,
        },
      });

      // Test that the same user always gets the same result
      const result1 = await repository.isEnabled('test_feature', 'user-123');
      const result2 = await repository.isEnabled('test_feature', 'user-123');

      expect(result1).toBe(result2);
    });

    it('should handle percentage segment without userId', async () => {
      mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
        ...mockFlag,
        segments: {
          type: 'percentage',
          percentage: 50,
        },
      });

      // Without userId, should return the flag's enabled status
      const result = await repository.isEnabled('test_feature');

      expect(result).toBe(true);
    });
  });

  describe('checkMultiple', () => {
    it('should return empty object for empty array', async () => {
      const result = await repository.checkMultiple([]);

      expect(result).toEqual({});
      expect(mockPrismaClient.featureFlag.findMany).not.toHaveBeenCalled();
    });

    it('should check multiple flags in a single query', async () => {
      const flags = [
        { ...mockFlag, key: 'flag1', enabled: true },
        { ...mockFlag, key: 'flag2', enabled: false },
        { ...mockFlag, key: 'flag3', enabled: true },
      ];

      mockPrismaClient.featureFlag.findMany.mockResolvedValue(flags);

      const result = await repository.checkMultiple(['flag1', 'flag2', 'flag3']);

      expect(result).toEqual({
        flag1: true,
        flag2: false,
        flag3: true,
      });

      expect(mockPrismaClient.featureFlag.findMany).toHaveBeenCalledWith({
        where: {
          key: {
            in: ['flag1', 'flag2', 'flag3'],
          },
        },
      });
      expect(mockPrismaClient.featureFlag.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return false for non-existent flags', async () => {
      // Return only one flag, the others don't exist
      mockPrismaClient.featureFlag.findMany.mockResolvedValue([
        { ...mockFlag, key: 'flag1', enabled: true },
      ]);

      const result = await repository.checkMultiple(['flag1', 'flag2', 'flag3']);

      expect(result).toEqual({
        flag1: true,
        flag2: false,
        flag3: false,
      });
    });

    it('should handle userIds segments in batch', async () => {
      const flags = [
        {
          ...mockFlag,
          key: 'flag1',
          enabled: true,
          segments: {
            type: 'userIds',
            userIds: ['user-1', 'user-2'],
          },
        },
        {
          ...mockFlag,
          key: 'flag2',
          enabled: true,
          segments: {
            type: 'userIds',
            userIds: ['user-3'],
          },
        },
      ];

      mockPrismaClient.featureFlag.findMany.mockResolvedValue(flags);

      const result = await repository.checkMultiple(['flag1', 'flag2'], 'user-1');

      expect(result).toEqual({
        flag1: true, // user-1 is in the list
        flag2: false, // user-1 is not in the list
      });
    });

    it('should handle percentage segments in batch', async () => {
      const flags = [
        {
          ...mockFlag,
          key: 'flag1',
          enabled: true,
          segments: {
            type: 'percentage',
            percentage: 100, // Always enabled
          },
        },
        {
          ...mockFlag,
          key: 'flag2',
          enabled: true,
          segments: {
            type: 'percentage',
            percentage: 0, // Never enabled
          },
        },
      ];

      mockPrismaClient.featureFlag.findMany.mockResolvedValue(flags);

      const result = await repository.checkMultiple(['flag1', 'flag2'], 'user-123');

      expect(result).toEqual({
        flag1: true,
        flag2: false,
      });
    });

    it('should handle mixed flags with and without segments', async () => {
      const flags = [
        { ...mockFlag, key: 'simple', enabled: true, segments: null },
        {
          ...mockFlag,
          key: 'segmented',
          enabled: true,
          segments: {
            type: 'userIds',
            userIds: ['user-1'],
          },
        },
      ];

      mockPrismaClient.featureFlag.findMany.mockResolvedValue(flags);

      const result = await repository.checkMultiple(['simple', 'segmented'], 'user-1');

      expect(result).toEqual({
        simple: true,
        segmented: true,
      });
    });
  });
});
