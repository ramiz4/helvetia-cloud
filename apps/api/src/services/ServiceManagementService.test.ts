import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import type { IDeploymentRepository, IServiceRepository, IUserRepository } from '../interfaces';
import { ServiceManagementService } from './ServiceManagementService';

describe('ServiceManagementService', () => {
  let service: ServiceManagementService;
  let mockServiceRepo: IServiceRepository;
  let mockDeploymentRepo: IDeploymentRepository;
  let mockUserRepo: IUserRepository;

  const mockService = {
    id: 'service-1',
    name: 'test-service',
    repoUrl: 'https://github.com/user/repo',
    branch: 'main',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    port: 3000,
    status: 'IDLE',
    userId: 'user-1',
    environmentId: 'env-1',
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

  beforeEach(() => {
    mockServiceRepo = {
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findByNameAndUserId: vi.fn(),
      findByNameAll: vi.fn(),
      findByNameAndEnvironment: vi.fn(),
      findByEnvironmentId: vi.fn(),
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

    const mockContainerOrchestrator = {
      listContainers: vi.fn().mockResolvedValue([]),
      getContainer: vi.fn(),
      createContainer: vi.fn(),
      startContainer: vi.fn(),
      stopContainer: vi.fn(),
      removeContainer: vi.fn(),
      buildImage: vi.fn(),
      pullImage: vi.fn(),
      inspectContainer: vi.fn(),
      getContainerLogs: vi.fn(),
      getContainerStats: vi.fn(),
      getDockerInstance: vi.fn(),
    };

    service = new ServiceManagementService(
      mockServiceRepo,
      mockDeploymentRepo,
      mockUserRepo,
      mockContainerOrchestrator as any,
    );
  });

  describe('getUserServices', () => {
    it('should return all services for a user', async () => {
      const services = [mockService];
      vi.mocked(mockServiceRepo.findByUserId).mockResolvedValue(services);

      const result = await service.getUserServices('user-1');

      expect(result).toEqual(services);
      expect(mockServiceRepo.findByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getServiceById', () => {
    it('should return service if user owns it', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      const result = await service.getServiceById('service-1', 'user-1');

      expect(result).toEqual(mockService);
      expect(mockServiceRepo.findById).toHaveBeenCalledWith('service-1');
    });

    it('should throw NotFoundError if service does not exist', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(null);

      await expect(service.getServiceById('service-1', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if service is soft deleted', async () => {
      const deletedService = { ...mockService, deletedAt: new Date() };
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(deletedService);

      await expect(service.getServiceById('service-1', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user does not own the service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      await expect(service.getServiceById('service-1', 'user-2')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('createOrUpdateService', () => {
    it('should create a new service', async () => {
      vi.mocked(mockServiceRepo.findByNameAndUserId).mockResolvedValue(null);
      vi.mocked(mockServiceRepo.findByNameAll).mockResolvedValue(null);
      vi.mocked(mockServiceRepo.create).mockResolvedValue(mockService);

      const result = await service.createOrUpdateService({
        name: 'test-service',
        userId: 'user-1',
        environmentId: 'env-1',
        type: 'DOCKER',
      });

      expect(result).toEqual(mockService);
      expect(mockServiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-service',
          userId: 'user-1',
          type: 'DOCKER',
        }),
      );
    });

    it('should update existing service', async () => {
      vi.mocked(mockServiceRepo.findByNameAndEnvironment).mockResolvedValue(mockService);
      vi.mocked(mockServiceRepo.update).mockResolvedValue(mockService);

      const result = await service.createOrUpdateService({
        name: 'test-service',
        userId: 'user-1',
        environmentId: 'env-1',
        type: 'DOCKER',
      });

      expect(result).toEqual(mockService);
      expect(mockServiceRepo.update).toHaveBeenCalled();
    });

    it('should throw ConflictError if environmentId is missing', async () => {
      const otherUserService = { ...mockService, userId: 'user-2' };
      vi.mocked(mockServiceRepo.findByNameAndEnvironment).mockRejectedValue(
        new Error('Should not be called when environmentId is missing'),
      );

      await expect(
        service.createOrUpdateService({
          name: 'test-service',
          userId: 'user-1',
          environmentId: 'env-1',
          type: 'DOCKER',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('should set default port for STATIC type', async () => {
      vi.mocked(mockServiceRepo.findByNameAndEnvironment).mockResolvedValue(null);
      vi.mocked(mockServiceRepo.create).mockResolvedValue(mockService);

      await service.createOrUpdateService({
        name: 'test-service',
        userId: 'user-1',
        environmentId: 'env-1',
        type: 'STATIC',
      });

      expect(mockServiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 80,
        }),
      );
    });

    it('should set default credentials for POSTGRES type', async () => {
      vi.mocked(mockServiceRepo.findByNameAndEnvironment).mockResolvedValue(null);
      vi.mocked(mockServiceRepo.create).mockResolvedValue(mockService);

      await service.createOrUpdateService({
        name: 'test-service',
        userId: 'user-1',
        environmentId: 'env-1',
        type: 'POSTGRES',
      });

      expect(mockServiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 5444,
          envVars: expect.objectContaining({
            POSTGRES_USER: 'postgres',
            POSTGRES_DB: 'app',
            POSTGRES_PASSWORD: expect.any(String),
          }),
        }),
      );
    });

    it('should set default credentials for REDIS type', async () => {
      vi.mocked(mockServiceRepo.findByNameAndEnvironment).mockResolvedValue(null);
      vi.mocked(mockServiceRepo.create).mockResolvedValue(mockService);

      await service.createOrUpdateService({
        name: 'test-service',
        userId: 'user-1',
        environmentId: 'env-1',
        type: 'REDIS',
      });

      expect(mockServiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 6379,
          envVars: expect.objectContaining({
            REDIS_PASSWORD: expect.any(String),
          }),
        }),
      );
    });

    it('should set default credentials for MYSQL type', async () => {
      vi.mocked(mockServiceRepo.findByNameAndEnvironment).mockResolvedValue(null);
      vi.mocked(mockServiceRepo.create).mockResolvedValue(mockService);

      await service.createOrUpdateService({
        name: 'test-service',
        userId: 'user-1',
        environmentId: 'env-1',
        type: 'MYSQL',
      });

      expect(mockServiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3306,
          envVars: expect.objectContaining({
            MYSQL_ROOT_PASSWORD: expect.any(String),
            MYSQL_DATABASE: 'app',
          }),
        }),
      );
    });
  });

  describe('updateService', () => {
    it('should update a service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockServiceRepo.update).mockResolvedValue(mockService);

      const result = await service.updateService('service-1', 'user-1', {
        name: 'updated-service',
      });

      expect(result).toEqual(mockService);
      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-1', {
        name: 'updated-service',
      });
    });

    it('should throw error if service does not exist', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(null);

      await expect(
        service.updateService('service-1', 'user-1', { name: 'updated' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('softDeleteService', () => {
    it('should soft delete a service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockServiceRepo.update).mockResolvedValue(mockService);

      await service.softDeleteService('service-1', 'user-1');

      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-1', {
        deletedAt: expect.any(Date),
      });
    });

    it('should throw ForbiddenError if service is delete protected', async () => {
      const protectedService = { ...mockService, deleteProtected: true };
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(protectedService);

      await expect(service.softDeleteService('service-1', 'user-1')).rejects.toThrow(
        ForbiddenError,
      );
    });
  });

  describe('recoverService', () => {
    it('should recover a soft-deleted service', async () => {
      const deletedService = { ...mockService, deletedAt: new Date() };
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(deletedService);
      vi.mocked(mockServiceRepo.update).mockResolvedValue(mockService);

      const result = await service.recoverService('service-1', 'user-1');

      expect(result).toEqual(mockService);
      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-1', {
        deletedAt: null,
      });
    });

    it('should throw ConflictError if service is not deleted', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      await expect(service.recoverService('service-1', 'user-1')).rejects.toThrow(ConflictError);
    });
  });

  describe('toggleDeleteProtection', () => {
    it('should toggle delete protection on', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockServiceRepo.update).mockResolvedValue({
        ...mockService,
        deleteProtected: true,
      });

      const result = await service.toggleDeleteProtection('service-1', 'user-1', true);

      expect(result.deleteProtected).toBe(true);
      expect(mockServiceRepo.update).toHaveBeenCalledWith('service-1', {
        deleteProtected: true,
      });
    });
  });

  describe('hardDeleteService', () => {
    it('should hard delete a service and its deployments', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.deleteByServiceId).mockResolvedValue();
      vi.mocked(mockServiceRepo.delete).mockResolvedValue();

      await service.hardDeleteService('service-1', 'user-1');

      expect(mockDeploymentRepo.deleteByServiceId).toHaveBeenCalledWith('service-1');
      expect(mockServiceRepo.delete).toHaveBeenCalledWith('service-1');
    });

    it('should not fail if service does not exist', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(null);

      await expect(service.hardDeleteService('service-1', 'user-1')).resolves.not.toThrow();
    });

    it('should throw ForbiddenError if user does not own the service', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);

      await expect(service.hardDeleteService('service-1', 'user-2')).rejects.toThrow(
        ForbiddenError,
      );
    });
  });

  describe('isServiceNameAvailable', () => {
    it('should return true if name is available', async () => {
      vi.mocked(mockServiceRepo.findByNameAndUserId).mockResolvedValue(null);
      vi.mocked(mockServiceRepo.findByNameAll).mockResolvedValue(null);

      const result = await service.isServiceNameAvailable('test-service', 'user-1');

      expect(result).toBe(true);
    });

    it('should return true if existing service is soft deleted', async () => {
      const deletedService = { ...mockService, deletedAt: new Date() };
      vi.mocked(mockServiceRepo.findByNameAndUserId).mockResolvedValue(deletedService);
      vi.mocked(mockServiceRepo.findByNameAll).mockResolvedValue(deletedService);

      const result = await service.isServiceNameAvailable('test-service', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false if name is taken', async () => {
      vi.mocked(mockServiceRepo.findByNameAndUserId).mockResolvedValue(mockService);
      vi.mocked(mockServiceRepo.findByNameAll).mockResolvedValue(mockService);

      const result = await service.isServiceNameAvailable('test-service', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('getServiceDeployments', () => {
    it('should return deployments for a service', async () => {
      const mockDeployments = [
        {
          id: 'deployment-1',
          serviceId: 'service-1',
          status: 'SUCCESS',
          logs: null,
          commitHash: 'abc123',
          imageTag: 'v1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.findByServiceId).mockResolvedValue(mockDeployments);

      const result = await service.getServiceDeployments('service-1', 'user-1');

      expect(result).toEqual(mockDeployments);
      expect(mockDeploymentRepo.findByServiceId).toHaveBeenCalledWith('service-1', undefined);
    });

    it('should throw error if service does not exist', async () => {
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(null);

      await expect(service.getServiceDeployments('service-1', 'user-1')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
