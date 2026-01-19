import { Prisma, PrismaClient } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service, ServiceCreateInput, ServiceUpdateInput } from '../interfaces/index.js';
import { PrismaServiceRepository } from './PrismaServiceRepository.js';

describe('PrismaServiceRepository', () => {
  let repository: PrismaServiceRepository;
  let mockPrisma: PrismaClient;

  const mockService: Service = {
    id: 'service-1',
    name: 'test-service',
    repoUrl: 'https://github.com/test/repo',
    branch: 'main',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    port: 3000,
    status: 'RUNNING',
    userId: 'user-1',
    envVars: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    customDomain: null,
    staticOutputDir: null,
    type: 'DOCKER',
    volumes: {},
    isPreview: false,
    prNumber: null,
    deletedAt: null,
    deleteProtected: false,
    environmentId: '123e4567-e89b-12d3-a456-426614174000',
  };

  beforeEach(() => {
    mockPrisma = {
      service: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    } as unknown as PrismaClient;

    repository = new PrismaServiceRepository(mockPrisma);
  });

  describe('findById', () => {
    it('should find service by id', async () => {
      vi.mocked(mockPrisma.service.findUnique).mockResolvedValue(mockService as any);

      const result = await repository.findById('service-1');

      expect(result).toEqual(mockService);
      expect(mockPrisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: 'service-1' },
        include: { environment: { include: { project: true } } },
      });
    });

    it('should return null when service not found', async () => {
      vi.mocked(mockPrisma.service.findUnique).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find services by user id', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService] as any);

      const result = await repository.findByUserId('user-1');

      expect(result).toEqual([mockService]);
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', deletedAt: null },
        include: { environment: { include: { project: true } } },
        take: undefined,
        skip: undefined,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should support pagination options', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService] as any);

      await repository.findByUserId('user-1', { take: 10, skip: 5 });

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', deletedAt: null },
        include: { environment: { include: { project: true } } },
        take: 10,
        skip: 5,
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('findByNameAndUserId', () => {
    it('should find service by name and user id', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(mockService as any);

      const result = await repository.findByNameAndUserId('test-service', 'user-1');

      expect(result).toEqual(mockService);
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: { name: 'test-service', userId: 'user-1', deletedAt: null },
      });
    });
  });

  describe('create', () => {
    it('should create a new service', async () => {
      const createInput: ServiceCreateInput = {
        name: 'test-service',
        userId: 'user-1',
        branch: 'main',
        port: 3000,
      };

      vi.mocked(mockPrisma.service.create).mockResolvedValue(mockService as any);

      const result = await repository.create(createInput);

      expect(result).toEqual(mockService);
      expect(mockPrisma.service.create).toHaveBeenCalledWith({
        data: {
          ...createInput,
          envVars: Prisma.JsonNull,
          volumes: Prisma.JsonNull,
        },
      });
    });
  });

  describe('update', () => {
    it('should update a service', async () => {
      const updateData: ServiceUpdateInput = {
        name: 'updated-service',
        status: 'STOPPED',
      };

      vi.mocked(mockPrisma.service.update).mockResolvedValue({
        ...mockService,
        ...updateData,
      } as any);

      const result = await repository.update('service-1', updateData);

      expect(result.name).toBe('updated-service');
      expect(mockPrisma.service.update).toHaveBeenCalledWith({
        where: { id: 'service-1' },
        data: updateData,
      });
    });
  });

  describe('delete', () => {
    it('should delete a service', async () => {
      vi.mocked(mockPrisma.service.delete).mockResolvedValue(mockService as any);

      await repository.delete('service-1');

      expect(mockPrisma.service.delete).toHaveBeenCalledWith({
        where: { id: 'service-1' },
      });
    });
  });

  describe('findByStatus', () => {
    it('should find services by status', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService] as any);

      const result = await repository.findByStatus('RUNNING');

      expect(result).toEqual([mockService]);
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { status: 'RUNNING', deletedAt: null },
        take: undefined,
        skip: undefined,
      });
    });
  });

  describe('findByEnvironmentId', () => {
    it('should find services by environment id', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService] as any);

      const result = await repository.findByEnvironmentId('env-1');

      expect(result).toEqual([mockService]);
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { environmentId: 'env-1', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('findByIdAndUserId', () => {
    it('should find service by id and user id', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(mockService as any);

      const result = await repository.findByIdAndUserId('service-1', 'user-1');

      expect(result).toEqual(mockService);
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: { id: 'service-1', userId: 'user-1', deletedAt: null },
      });
    });

    it('should return null when service not found', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(null);

      const result = await repository.findByIdAndUserId('service-1', 'user-2');

      expect(result).toBeNull();
    });

    it('should exclude soft-deleted services', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(null);

      await repository.findByIdAndUserId('service-1', 'user-1');

      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: { id: 'service-1', userId: 'user-1', deletedAt: null },
      });
    });
  });

  describe('findByIdAndUserIdWithEnvironment', () => {
    it('should find service with environment by id and user id', async () => {
      const serviceWithEnv = {
        ...mockService,
        environment: {
          id: 'env-1',
          name: 'production',
          project: { id: 'proj-1', name: 'My Project' },
        },
      };
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(serviceWithEnv as any);

      const result = await repository.findByIdAndUserIdWithEnvironment('service-1', 'user-1');

      expect(result).toEqual(serviceWithEnv);
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: { id: 'service-1', userId: 'user-1', deletedAt: null },
        include: { environment: { include: { project: true } } },
      });
    });

    it('should return null when service not found', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(null);

      const result = await repository.findByIdAndUserIdWithEnvironment('service-1', 'user-2');

      expect(result).toBeNull();
    });

    it('should exclude soft-deleted services', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(null);

      await repository.findByIdAndUserIdWithEnvironment('service-1', 'user-1');

      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: { id: 'service-1', userId: 'user-1', deletedAt: null },
        include: { environment: { include: { project: true } } },
      });
    });
  });

  describe('findBaseServiceByRepoUrl', () => {
    it('should find base service with exact repo URL', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(mockService as any);

      const condition = { repoUrl: 'https://github.com/test/repo' };
      const result = await repository.findBaseServiceByRepoUrl(condition);

      expect(result).toEqual(mockService);
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: {
          repoUrl: 'https://github.com/test/repo',
          isPreview: false,
          deletedAt: null,
        },
      });
    });

    it('should find base service with OR condition for .git suffix', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(mockService as any);

      const condition = {
        OR: [
          { repoUrl: 'https://github.com/test/repo' },
          { repoUrl: 'https://github.com/test/repo.git' },
        ],
      };
      const result = await repository.findBaseServiceByRepoUrl(condition);

      expect(result).toEqual(mockService);
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { repoUrl: 'https://github.com/test/repo' },
            { repoUrl: 'https://github.com/test/repo.git' },
          ],
          isPreview: false,
          deletedAt: null,
        },
      });
    });

    it('should return null when base service not found', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(null);

      const result = await repository.findBaseServiceByRepoUrl({ repoUrl: null });

      expect(result).toBeNull();
    });

    it('should exclude preview services and soft-deleted services', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(null);

      await repository.findBaseServiceByRepoUrl({ repoUrl: 'https://github.com/test/repo' });

      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: {
          repoUrl: 'https://github.com/test/repo',
          isPreview: false,
          deletedAt: null,
        },
      });
    });
  });

  describe('findPreviewByPrNumberAndRepoUrl', () => {
    it('should find preview service by PR number and repo URL', async () => {
      const previewService = { ...mockService, isPreview: true, prNumber: 42 };
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(previewService as any);

      const condition = { repoUrl: 'https://github.com/test/repo' };
      const result = await repository.findPreviewByPrNumberAndRepoUrl(42, condition);

      expect(result).toEqual(previewService);
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: {
          prNumber: 42,
          repoUrl: 'https://github.com/test/repo',
          isPreview: true,
          deletedAt: null,
        },
      });
    });

    it('should find preview service with OR condition for .git suffix', async () => {
      const previewService = { ...mockService, isPreview: true, prNumber: 42 };
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(previewService as any);

      const condition = {
        OR: [
          { repoUrl: 'https://github.com/test/repo' },
          { repoUrl: 'https://github.com/test/repo.git' },
        ],
      };
      const result = await repository.findPreviewByPrNumberAndRepoUrl(42, condition);

      expect(result).toEqual(previewService);
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: {
          prNumber: 42,
          OR: [
            { repoUrl: 'https://github.com/test/repo' },
            { repoUrl: 'https://github.com/test/repo.git' },
          ],
          isPreview: true,
          deletedAt: null,
        },
      });
    });

    it('should return null when preview service not found', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(null);

      const result = await repository.findPreviewByPrNumberAndRepoUrl(42, { repoUrl: null });

      expect(result).toBeNull();
    });

    it('should only return preview services', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(null);

      await repository.findPreviewByPrNumberAndRepoUrl(42, {
        repoUrl: 'https://github.com/test/repo',
      });

      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: {
          prNumber: 42,
          repoUrl: 'https://github.com/test/repo',
          isPreview: true,
          deletedAt: null,
        },
      });
    });
  });

  describe('findByRepoUrlAndBranch', () => {
    it('should find services by repo URL and branch', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService] as any);

      const condition = { repoUrl: 'https://github.com/test/repo' };
      const result = await repository.findByRepoUrlAndBranch(condition, 'main');

      expect(result).toEqual([mockService]);
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          isPreview: false,
          deletedAt: null,
        },
      });
    });

    it('should find services with OR condition for .git suffix', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService] as any);

      const condition = {
        OR: [
          { repoUrl: 'https://github.com/test/repo' },
          { repoUrl: 'https://github.com/test/repo.git' },
        ],
      };
      const result = await repository.findByRepoUrlAndBranch(condition, 'develop');

      expect(result).toEqual([mockService]);
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { repoUrl: 'https://github.com/test/repo' },
            { repoUrl: 'https://github.com/test/repo.git' },
          ],
          branch: 'develop',
          isPreview: false,
          deletedAt: null,
        },
      });
    });

    it('should return empty array when no services found', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([]);

      const result = await repository.findByRepoUrlAndBranch({ repoUrl: null }, 'main');

      expect(result).toEqual([]);
    });

    it('should exclude preview services and soft-deleted services', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([]);

      await repository.findByRepoUrlAndBranch({ repoUrl: 'https://github.com/test/repo' }, 'main');

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          isPreview: false,
          deletedAt: null,
        },
      });
    });
  });
});
