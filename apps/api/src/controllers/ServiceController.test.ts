import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../errors';
import { ServiceController } from './ServiceController';

// Mock database module
vi.mock('database', () => ({
  prisma: {
    service: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock dockerode with proper constructor
vi.mock('dockerode', () => {
  class MockDocker {
    listContainers() {
      return Promise.resolve([
        {
          Id: 'container-1',
          Labels: { 'helvetia.serviceId': 'service-1' },
          State: 'running',
        },
      ]);
    }
    getContainer() {
      return {
        inspect: () =>
          Promise.resolve({
            State: {
              Running: true,
              Health: { Status: 'healthy' },
              StartedAt: '2024-01-01T00:00:00Z',
              ExitCode: 0,
            },
          }),
      };
    }
  }

  return { default: MockDocker };
});

vi.mock('../handlers/metrics.handler', () => ({
  getServiceMetrics: vi
    .fn()
    .mockResolvedValue({ cpu: 10, memory: 100, memoryLimit: 512, status: 'RUNNING' }),
}));

vi.mock('../utils/helpers/status.helper', () => ({
  determineServiceStatus: vi.fn((service) => service.status || 'IDLE'),
  getDefaultPortForServiceType: vi.fn(() => 3000),
}));

describe('ServiceController', () => {
  let controller: ServiceController;
  let mockServiceRepo: any;
  let mockDeploymentRepo: any;
  let mockRequest: any;
  let mockReply: any;
  let mockServiceManagement: any;
  let mockContainerOrchestrator: any;

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
    status: 'SUCCESS',
    logs: '',
    imageTag: 'test:latest',
    commitHash: 'abc123',
    createdAt: new Date(),
    updatedAt: new Date(),
    finishedAt: new Date(),
  };

  beforeEach(() => {
    mockServiceRepo = {
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findByNameAndUserId: vi.fn(),
      findByNameAll: vi.fn(),
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

    mockServiceManagement = {
      createOrUpdateService: vi.fn(),
      softDeleteService: vi.fn(),
      getUserServices: vi.fn(),
      getServiceById: vi.fn(),
      isServiceNameAvailable: vi.fn(),
    };

    mockContainerOrchestrator = {
      listContainers: vi.fn().mockResolvedValue([
        {
          id: 'container-1',
          name: 'test-container',
          state: 'running',
          status: 'Up 5 minutes',
          image: 'test:latest',
          labels: { 'helvetia.serviceId': 'service-1' },
        },
      ]),
      getContainer: vi.fn().mockResolvedValue({
        inspect: vi.fn().mockResolvedValue({
          State: {
            Running: true,
            Health: { Status: 'healthy' },
            StartedAt: '2024-01-01T00:00:00Z',
            ExitCode: 0,
          },
        }),
      }),
      inspectContainer: vi.fn().mockResolvedValue({
        State: {
          Running: true,
          Health: { Status: 'healthy' },
          StartedAt: '2024-01-01T00:00:00Z',
          ExitCode: 0,
        },
      }),
    };

    mockRequest = {
      params: {},
      body: {},
      user: { id: 'user-1', username: 'testuser' },
      headers: {},
      raw: {
        on: vi.fn(),
      },
    } as any;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      raw: {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      },
    } as any;

    controller = new ServiceController(
      mockServiceRepo,
      mockDeploymentRepo,
      mockServiceManagement as any,
      mockContainerOrchestrator,
    );
  });

  describe('getAllServices', () => {
    it('should return all services for authenticated user', async () => {
      const services = [mockService];
      vi.mocked(mockServiceRepo.findByUserId).mockResolvedValue(services);
      vi.mocked(mockDeploymentRepo.findByServiceId).mockResolvedValue([mockDeployment]);

      const result = await controller.getAllServices(mockRequest as any);

      expect(result).toHaveLength(1);
      expect(mockServiceRepo.findByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getServiceById', () => {
    it('should return service if user owns it', async () => {
      mockRequest.params = { id: 'service-1' };
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.findByServiceId).mockResolvedValue([mockDeployment]);

      const result = await controller.getServiceById(mockRequest as any, mockReply as any);

      expect(result).toHaveProperty('id', 'service-1');
    });

    it('should return 404 if service does not exist', async () => {
      mockRequest.params = { id: 'service-1' };
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(null);

      await controller.getServiceById(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createService', () => {
    it('should delegate creation to ServiceManagementService', async () => {
      const createData = {
        name: 'new-service',
        type: 'DOCKER',
      };
      mockRequest.body = createData;
      vi.mocked(mockServiceManagement.createOrUpdateService).mockResolvedValue(mockService);

      const result = await controller.createService(mockRequest as any, mockReply as any);

      expect(mockServiceManagement.createOrUpdateService).toHaveBeenCalled();
      expect(result).toEqual(mockService);
    });

    it('should return 403 if creation fails with ForbiddenError', async () => {
      mockRequest.body = { name: 'forbidden' };
      vi.mocked(mockServiceManagement.createOrUpdateService).mockRejectedValue(
        new ForbiddenError('Forbidden'),
      );

      await controller.createService(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });
  });

  describe('deleteService', () => {
    it('should delegate deletion to ServiceManagementService', async () => {
      mockRequest.params = { id: 'service-1' };
      vi.mocked(mockServiceManagement.softDeleteService).mockResolvedValue(undefined);

      const result = await controller.deleteService(mockRequest as any, mockReply as any);

      expect(mockServiceManagement.softDeleteService).toHaveBeenCalledWith('service-1', 'user-1');
      expect(result).toHaveProperty('success', true);
    });

    it('should return 404 if service not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      vi.mocked(mockServiceManagement.softDeleteService).mockRejectedValue(
        new NotFoundError('Not found'),
      );

      await controller.deleteService(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if deletion forbidden', async () => {
      mockRequest.params = { id: 'protected' };
      vi.mocked(mockServiceManagement.softDeleteService).mockRejectedValue(
        new ForbiddenError('Forbidden'),
      );

      await controller.deleteService(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(403);
    });
  });

  describe('streamMetrics', () => {
    it('should set up SSE headers', async () => {
      await controller.streamMetrics(mockRequest as any, mockReply as any);

      expect(mockReply.raw.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          'Content-Type': 'text/event-stream',
        }),
      );
    });
  });

  describe('Container Orchestrator Reuse', () => {
    it('should reuse injected container orchestrator across multiple calls', async () => {
      vi.mocked(mockServiceRepo.findByUserId).mockResolvedValue([mockService]);
      vi.mocked(mockDeploymentRepo.findByServiceId).mockResolvedValue([mockDeployment]);

      // Call getAllServices multiple times
      await controller.getAllServices(mockRequest as any);
      await controller.getAllServices(mockRequest as any);
      await controller.getAllServices(mockRequest as any);

      // Verify that the same orchestrator instance was used
      // (listContainers should be called 3 times on the same instance)
      expect(mockContainerOrchestrator.listContainers).toHaveBeenCalledTimes(3);
    });

    it('should use container orchestrator in getServiceById', async () => {
      mockRequest.params = { id: 'service-1' };
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockDeploymentRepo.findByServiceId).mockResolvedValue([mockDeployment]);

      await controller.getServiceById(mockRequest as any, mockReply as any);

      // Verify container orchestrator was used instead of creating new Docker instance
      expect(mockContainerOrchestrator.listContainers).toHaveBeenCalled();
    });

    it('should use container orchestrator in updateService', async () => {
      mockRequest.params = { id: 'service-1' };
      mockRequest.body = { name: 'updated-service' };
      vi.mocked(mockServiceRepo.findById).mockResolvedValue(mockService);
      vi.mocked(mockServiceRepo.update).mockResolvedValue({
        ...mockService,
        name: 'updated-service',
      });
      vi.mocked(mockDeploymentRepo.findByServiceId).mockResolvedValue([mockDeployment]);

      await controller.updateService(mockRequest as any, mockReply as any);

      // Verify container orchestrator was used
      expect(mockContainerOrchestrator.listContainers).toHaveBeenCalled();
    });
  });
});
