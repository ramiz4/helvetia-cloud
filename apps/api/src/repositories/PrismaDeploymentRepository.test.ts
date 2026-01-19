import { PrismaClient } from '@prisma/client';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Deployment,
  DeploymentCreateInput,
  DeploymentUpdateInput,
} from '../interfaces/index.js';
import { PrismaDeploymentRepository } from './PrismaDeploymentRepository.js';

describe('PrismaDeploymentRepository', () => {
  let repository: PrismaDeploymentRepository;
  let mockPrisma: PrismaClient;

  const mockDeployment: Deployment = {
    id: 'deployment-1',
    serviceId: 'service-1',
    status: 'COMPLETED',
    logs: 'Build successful',
    commitHash: 'abc123',
    imageTag: 'v1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      deployment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
    } as unknown as PrismaClient;

    repository = new PrismaDeploymentRepository(mockPrisma);
  });

  describe('findById', () => {
    it('should find deployment by id', async () => {
      vi.mocked(mockPrisma.deployment.findUnique).mockResolvedValue(mockDeployment);

      const result = await repository.findById('deployment-1');

      expect(result).toEqual(mockDeployment);
      expect(mockPrisma.deployment.findUnique).toHaveBeenCalledWith({
        where: { id: 'deployment-1' },
      });
    });

    it('should return null when deployment not found', async () => {
      vi.mocked(mockPrisma.deployment.findUnique).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByServiceId', () => {
    it('should find deployments by service id', async () => {
      vi.mocked(mockPrisma.deployment.findMany).mockResolvedValue([mockDeployment]);

      const result = await repository.findByServiceId('service-1');

      expect(result).toEqual([mockDeployment]);
      expect(mockPrisma.deployment.findMany).toHaveBeenCalledWith({
        where: { serviceId: 'service-1' },
        orderBy: { createdAt: 'desc' },
        take: undefined,
        skip: undefined,
      });
    });

    it('should support pagination options', async () => {
      vi.mocked(mockPrisma.deployment.findMany).mockResolvedValue([mockDeployment]);

      await repository.findByServiceId('service-1', { take: 5, skip: 10 });

      expect(mockPrisma.deployment.findMany).toHaveBeenCalledWith({
        where: { serviceId: 'service-1' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        skip: 10,
      });
    });
  });

  describe('create', () => {
    it('should create a new deployment', async () => {
      const createInput: DeploymentCreateInput = {
        serviceId: 'service-1',
        status: 'QUEUED',
        commitHash: 'abc123',
      };

      vi.mocked(mockPrisma.deployment.create).mockResolvedValue(mockDeployment);

      const result = await repository.create(createInput);

      expect(result).toEqual(mockDeployment);
      expect(mockPrisma.deployment.create).toHaveBeenCalledWith({
        data: createInput,
      });
    });
  });

  describe('update', () => {
    it('should update a deployment', async () => {
      const updateData: DeploymentUpdateInput = {
        status: 'COMPLETED',
        logs: 'Build successful',
      };

      vi.mocked(mockPrisma.deployment.update).mockResolvedValue({
        ...mockDeployment,
        ...updateData,
      });

      const result = await repository.update('deployment-1', updateData);

      expect(result.status).toBe('COMPLETED');
      expect(mockPrisma.deployment.update).toHaveBeenCalledWith({
        where: { id: 'deployment-1' },
        data: updateData,
      });
    });
  });

  describe('delete', () => {
    it('should delete a deployment', async () => {
      vi.mocked(mockPrisma.deployment.delete).mockResolvedValue(mockDeployment);

      await repository.delete('deployment-1');

      expect(mockPrisma.deployment.delete).toHaveBeenCalledWith({
        where: { id: 'deployment-1' },
      });
    });
  });

  describe('deleteByServiceId', () => {
    it('should delete all deployments for a service', async () => {
      vi.mocked(mockPrisma.deployment.deleteMany).mockResolvedValue({ count: 3 });

      await repository.deleteByServiceId('service-1');

      expect(mockPrisma.deployment.deleteMany).toHaveBeenCalledWith({
        where: { serviceId: 'service-1' },
      });
    });
  });

  describe('countByServiceId', () => {
    it('should count deployments for a service', async () => {
      vi.mocked(mockPrisma.deployment.count).mockResolvedValue(5);

      const result = await repository.countByServiceId('service-1');

      expect(result).toBe(5);
      expect(mockPrisma.deployment.count).toHaveBeenCalledWith({
        where: { serviceId: 'service-1' },
      });
    });
  });
});
