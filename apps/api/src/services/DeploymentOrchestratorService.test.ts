import type { Queue } from 'bullmq';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../errors';
import type {
  IDeploymentRepository,
  IServiceRepository,
  IUserRepository,
  Service,
} from '../interfaces';
import { DeploymentOrchestratorService } from './DeploymentOrchestratorService';

// Mock the crypto module
vi.mock('../utils/crypto', () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => {
    if (text && text.startsWith('encrypted_')) {
      return text.replace('encrypted_', '');
    }
    throw new Error('Invalid encrypted text format');
  }),
}));

describe('DeploymentOrchestratorService', () => {
  let service: DeploymentOrchestratorService;
  let mockServiceRepo: IServiceRepository;
  let mockDeploymentRepo: IDeploymentRepository;
  let mockUserRepo: IUserRepository;
  let mockQueue: Queue;

  const mockService: Service = {
    id: 'service-1',
    name: 'test-service',
    repoUrl: 'https://github.com/user/repo',
    branch: 'main',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    port: 3000,
    status: 'IDLE',
    userId: 'user-1',
    envVars: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    customDomain: null,
    staticOutputDir: 'dist',
    type: 'DOCKER',
    isPreview: false,
    prNumber: null,
    deletedAt: null,
    deleteProtected: false,
  };

  const mockDeployment = {
    id: 'deployment-1',
    serviceId: 'service-1',
    status: 'QUEUED',
    logs: null,
    commitHash: 'abc123',
    imageTag: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    avatarUrl: 'https://avatar.url',
    githubId: '123456',
    githubAccessToken: 'encrypted_github-token',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockServiceRepo = {
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findByNameAndUserId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByStatus: vi.fn(),
      findAll: vi.fn(),
    };

    mockDeploymentRepo = {
      findById: vi.fn(),
      findByServiceId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByServiceId: vi.fn(),
      countByServiceId: vi.fn(),
    };

    mockUserRepo = {
      findById: vi.fn(),
      findByGithubId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    };

    mockQueue = {
      add: vi.fn(),
    } as any;

    service = new DeploymentOrchestratorService(
      mockServiceRepo,
      mockDeploymentRepo,
      mockUserRepo,
      mockQueue,
    );
  });

  describe('createAndQueueDeployment', () => {
    it('should create and queue a deployment', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.create).mockResolvedValue(mockDeployment);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(mockQueue.add).mockResolvedValue({} as any);

      const result = await service.createAndQueueDeployment('service-1', 'user-1', 'abc123');

      expect(result).toEqual(mockDeployment);
      expect(mockDeploymentRepo.create).toHaveBeenCalledWith({
        serviceId: 'service-1',
        status: 'QUEUED',
        commitHash: 'abc123',
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'build',
        expect.objectContaining({
          deploymentId: 'deployment-1',
          serviceId: 'service-1',
          serviceName: 'test-service',
        }),
      );
    });

    it('should throw NotFoundError if service does not exist', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(null);

      await expect(service.createAndQueueDeployment('service-1', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotFoundError if service is soft deleted', async () => {
      const deletedService = { ...mockService, deletedAt: new Date() };
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(deletedService);

      await expect(service.createAndQueueDeployment('service-1', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotFoundError if user does not own the service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      await expect(service.createAndQueueDeployment('service-1', 'user-2')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should inject GitHub token in repoUrl', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.create).mockResolvedValue(mockDeployment);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(mockUser);
      vi.mocked(mockQueue.add).mockResolvedValue({} as any);

      await service.createAndQueueDeployment('service-1', 'user-1');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'build',
        expect.objectContaining({
          repoUrl: expect.stringContaining('@'),
        }),
      );
    });

    it('should handle missing GitHub token', async () => {
      const userWithoutToken = { ...mockUser, githubAccessToken: null };
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.create).mockResolvedValue(mockDeployment);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(userWithoutToken);
      vi.mocked(mockQueue.add).mockResolvedValue({} as any);

      await service.createAndQueueDeployment('service-1', 'user-1');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'build',
        expect.objectContaining({
          repoUrl: mockService.repoUrl,
        }),
      );
    });
  });

  describe('getDeployment', () => {
    it('should return deployment if user owns the service', async () => {
      vi.mocked(mockDeploymentRepo.findById).mockResolvedValue(mockDeployment);
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      const result = await service.getDeployment('deployment-1', 'user-1');

      expect(result).toEqual(mockDeployment);
    });

    it('should throw NotFoundError if deployment does not exist', async () => {
      vi.mocked(mockDeploymentRepo.findById).mockResolvedValue(null);

      await expect(service.getDeployment('deployment-1', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user does not own the service', async () => {
      vi.mocked(mockDeploymentRepo.findById).mockResolvedValue(mockDeployment);
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      await expect(service.getDeployment('deployment-1', 'user-2')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getServiceDeployments', () => {
    it('should return all deployments for a service', async () => {
      const deployments = [mockDeployment];
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.findByServiceId).mockResolvedValue(deployments);

      const result = await service.getServiceDeployments('service-1', 'user-1');

      expect(result).toEqual(deployments);
      expect(mockDeploymentRepo.findByServiceId).toHaveBeenCalledWith('service-1', undefined);
    });

    it('should support pagination options', async () => {
      const deployments = [mockDeployment];
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.findByServiceId).mockResolvedValue(deployments);

      await service.getServiceDeployments('service-1', 'user-1', { take: 10, skip: 0 });

      expect(mockDeploymentRepo.findByServiceId).toHaveBeenCalledWith('service-1', {
        take: 10,
        skip: 0,
      });
    });

    it('should throw NotFoundError if service does not exist', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(null);

      await expect(service.getServiceDeployments('service-1', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotFoundError if user does not own the service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      await expect(service.getServiceDeployments('service-1', 'user-2')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('updateDeploymentStatus', () => {
    it('should update deployment status', async () => {
      const updatedDeployment = { ...mockDeployment, status: 'BUILDING' };
      vi.mocked(mockDeploymentRepo.update).mockResolvedValue(updatedDeployment);

      const result = await service.updateDeploymentStatus('deployment-1', 'BUILDING');

      expect(result).toEqual(updatedDeployment);
      expect(mockDeploymentRepo.update).toHaveBeenCalledWith('deployment-1', {
        status: 'BUILDING',
        logs: undefined,
      });
    });

    it('should update deployment status with logs', async () => {
      const updatedDeployment = { ...mockDeployment, status: 'FAILED', logs: 'Build failed' };
      vi.mocked(mockDeploymentRepo.update).mockResolvedValue(updatedDeployment);

      const result = await service.updateDeploymentStatus('deployment-1', 'FAILED', 'Build failed');

      expect(result).toEqual(updatedDeployment);
      expect(mockDeploymentRepo.update).toHaveBeenCalledWith('deployment-1', {
        status: 'FAILED',
        logs: 'Build failed',
      });
    });
  });

  describe('deleteServiceDeployments', () => {
    it('should delete all deployments for a service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.deleteByServiceId).mockResolvedValue();

      await service.deleteServiceDeployments('service-1', 'user-1');

      expect(mockDeploymentRepo.deleteByServiceId).toHaveBeenCalledWith('service-1');
    });

    it('should throw NotFoundError if service does not exist', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(null);

      await expect(service.deleteServiceDeployments('service-1', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotFoundError if user does not own the service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      await expect(service.deleteServiceDeployments('service-1', 'user-2')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getDeploymentCount', () => {
    it('should return deployment count for a service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.countByServiceId).mockResolvedValue(5);

      const result = await service.getDeploymentCount('service-1', 'user-1');

      expect(result).toBe(5);
      expect(mockDeploymentRepo.countByServiceId).toHaveBeenCalledWith('service-1');
    });

    it('should throw NotFoundError if service does not exist', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(null);

      await expect(service.getDeploymentCount('service-1', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotFoundError if user does not own the service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      await expect(service.getDeploymentCount('service-1', 'user-2')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
