import { PrismaClient } from '@prisma/client';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service, ServiceCreateInput, ServiceUpdateInput } from '../interfaces';
import { PrismaServiceRepository } from './PrismaServiceRepository';

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
    isPreview: false,
    prNumber: null,
    deletedAt: null,
    deleteProtected: false,
    environmentId: 'env-1',
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
      vi.mocked(mockPrisma.service.findUnique).mockResolvedValue(mockService);

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
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService]);

      const result = await repository.findByUserId('user-1');

      expect(result).toEqual([mockService]);
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', deletedAt: null },
        include: { environment: { include: { project: true } } },
        take: undefined,
        skip: undefined,
      });
    });

    it('should support pagination options', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService]);

      await repository.findByUserId('user-1', { take: 10, skip: 5 });

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', deletedAt: null },
        include: { environment: { include: { project: true } } },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('findByNameAndUserId', () => {
    it('should find service by name and user id', async () => {
      vi.mocked(mockPrisma.service.findFirst).mockResolvedValue(mockService);

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

      vi.mocked(mockPrisma.service.create).mockResolvedValue(mockService);

      const result = await repository.create(createInput);

      expect(result).toEqual(mockService);
      expect(mockPrisma.service.create).toHaveBeenCalledWith({
        data: createInput,
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
      });

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
      vi.mocked(mockPrisma.service.delete).mockResolvedValue(mockService);

      await repository.delete('service-1');

      expect(mockPrisma.service.delete).toHaveBeenCalledWith({
        where: { id: 'service-1' },
      });
    });
  });

  describe('findByStatus', () => {
    it('should find services by status', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService]);

      const result = await repository.findByStatus('RUNNING');

      expect(result).toEqual([mockService]);
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { status: 'RUNNING', deletedAt: null },
        take: undefined,
        skip: undefined,
      });
    });
  });

  describe('findAll', () => {
    it('should find all services', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService]);

      const result = await repository.findAll();

      expect(result).toEqual([mockService]);
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        take: undefined,
        skip: undefined,
      });
    });

    it('should support pagination', async () => {
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([mockService]);

      await repository.findAll({ take: 20, skip: 10 });

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        take: 20,
        skip: 10,
      });
    });
  });
});
