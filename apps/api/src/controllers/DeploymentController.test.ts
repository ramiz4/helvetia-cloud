import type { FastifyReply, FastifyRequest } from 'fastify';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../errors';
import type { IDeploymentRepository, IServiceRepository } from '../interfaces';
import { DeploymentOrchestratorService } from '../services';
import { DeploymentController } from './DeploymentController';

// Mock database module
vi.mock('database', () => ({
  prisma: {
    service: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock dockerode
vi.mock('dockerode', () => {
  class MockDocker {
    listContainers() {
      return Promise.resolve([
        {
          Id: 'container-1',
          Labels: { 'helvetia.serviceId': 'service-1' },
        },
      ]);
    }
    getContainer() {
      return {
        inspect: () =>
          Promise.resolve({
            Config: {
              Image: 'test-image:latest',
            },
          }),
        stop: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      };
    }
    createContainer() {
      return Promise.resolve({
        start: vi.fn().mockResolvedValue(undefined),
      });
    }
  }

  return { default: MockDocker };
});

// Mock utils
vi.mock('../utils/helpers/cors.helper', () => ({
  getSafeOrigin: vi.fn(() => 'http://localhost:3000'),
}));

vi.mock('../utils/tokenValidation', () => ({
  validateToken: vi.fn().mockResolvedValue(true),
}));

vi.mock('../utils/statusLock', () => ({
  withStatusLock: vi.fn((id, fn) => fn()),
}));

describe('DeploymentController', () => {
  let controller: DeploymentController;
  let mockDeploymentService: DeploymentOrchestratorService;
  let mockServiceRepo: IServiceRepository;
  let mockDeploymentRepo: IDeploymentRepository;
  let mockContainerOrchestrator: any;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  const mockDeployment = {
    id: 'deployment-1',
    serviceId: 'service-1',
    status: 'QUEUED',
    logs: 'Build logs',
    imageTag: null,
    commitHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    finishedAt: null,
  };

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

  beforeEach(() => {
    vi.clearAllMocks();

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
      findByNameAndEnvironment: vi.fn(),
      findByEnvironmentId: vi.fn(),
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

    mockDeploymentService = {
      createAndQueueDeployment: vi.fn(),
      getDeployment: vi.fn(),
      getServiceDeployments: vi.fn(),
      updateDeploymentStatus: vi.fn(),
      deleteServiceDeployments: vi.fn(),
      getDeploymentCount: vi.fn(),
    } as any;

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
      getContainer: vi.fn().mockReturnValue({
        inspect: vi.fn().mockResolvedValue({
          Config: {
            Image: 'test-image:latest',
          },
        }),
        stop: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      }),
      getDockerInstance: vi.fn().mockReturnValue({
        getContainer: vi.fn().mockReturnValue({
          inspect: vi.fn().mockResolvedValue({
            Config: {
              Image: 'test-image:latest',
            },
          }),
          stop: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        }),
        createContainer: vi.fn().mockResolvedValue({
          start: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    controller = new DeploymentController(
      mockDeploymentService,
      mockServiceRepo,
      mockDeploymentRepo,
      mockContainerOrchestrator,
    );

    mockRequest = {
      params: {},
      body: {},
      headers: {},
      user: { id: 'user-1', username: 'testuser' },
      server: {
        redis: {
          subscribe: vi.fn().mockResolvedValue(undefined),
          unsubscribe: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          removeListener: vi.fn(),
        },
      },
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
  });

  describe('deployService', () => {
    it('should successfully deploy a service', async () => {
      mockRequest.params = { id: 'service-1' };
      vi.mocked(mockDeploymentService.createAndQueueDeployment).mockResolvedValue(mockDeployment);

      const result = await controller.deployService(mockRequest as any, mockReply as any);

      expect(mockDeploymentService.createAndQueueDeployment).toHaveBeenCalledWith(
        'service-1',
        'user-1',
        undefined,
        mockRequest.id,
      );
      expect(result).toEqual(mockDeployment);
    });

    it('should return 404 when service not found', async () => {
      mockRequest.params = { id: 'service-1' };
      vi.mocked(mockDeploymentService.createAndQueueDeployment).mockRejectedValue(
        new NotFoundError('Service not found'),
      );

      await controller.deployService(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Service not found' });
    });

    it('should return 404 when user unauthorized', async () => {
      mockRequest.params = { id: 'service-1' };
      vi.mocked(mockDeploymentService.createAndQueueDeployment).mockRejectedValue(
        new ForbiddenError('Unauthorized access to service'),
      );

      await controller.deployService(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Service not found' });
    });
  });

  describe('getServiceDeployments', () => {
    it('should return deployments for a service', async () => {
      mockRequest.params = { id: 'service-1' };
      const mockDeployments = [mockDeployment];
      vi.mocked(mockDeploymentService.getServiceDeployments).mockResolvedValue(mockDeployments);

      const result = await controller.getServiceDeployments(mockRequest as any, mockReply as any);

      expect(mockDeploymentService.getServiceDeployments).toHaveBeenCalledWith(
        'service-1',
        'user-1',
      );
      expect(result).toEqual(mockDeployments);
    });

    it('should return 404 when service not found', async () => {
      mockRequest.params = { id: 'service-1' };
      vi.mocked(mockDeploymentService.getServiceDeployments).mockRejectedValue(
        new NotFoundError('Service not found'),
      );

      await controller.getServiceDeployments(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Service not found' });
    });
  });

  describe('getDeploymentLogs', () => {
    it('should return deployment logs', async () => {
      mockRequest.params = { id: 'deployment-1' };
      vi.mocked(mockDeploymentService.getDeployment).mockResolvedValue(mockDeployment);

      const result = await controller.getDeploymentLogs(mockRequest as any, mockReply as any);

      expect(mockDeploymentService.getDeployment).toHaveBeenCalledWith('deployment-1', 'user-1');
      expect(result).toEqual({ logs: 'Build logs' });
    });

    it('should return 404 when deployment not found', async () => {
      mockRequest.params = { id: 'deployment-1' };
      vi.mocked(mockDeploymentService.getDeployment).mockRejectedValue(
        new NotFoundError('Deployment not found'),
      );

      await controller.getDeploymentLogs(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Deployment not found' });
    });

    it('should return 404 when user unauthorized', async () => {
      mockRequest.params = { id: 'deployment-1' };
      vi.mocked(mockDeploymentService.getDeployment).mockRejectedValue(
        new ForbiddenError('Unauthorized'),
      );

      await controller.getDeploymentLogs(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Deployment not found or unauthorized',
      });
    });
  });

  describe('restartService', () => {
    it('should successfully restart a service', async () => {
      mockRequest.params = { id: 'service-1' };

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findFirst).mockResolvedValue(mockService as any);

      const result = await controller.restartService(mockRequest as any, mockReply as any);

      expect(result).toMatchObject({ success: true, message: 'Container restarted successfully' });
      expect(result).toHaveProperty('containerName');
    });

    it('should return 404 when service not found', async () => {
      mockRequest.params = { id: 'service-1' };

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);

      await controller.restartService(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Service not found' });
    });

    it('should return 400 for COMPOSE services', async () => {
      mockRequest.params = { id: 'service-1' };

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findFirst).mockResolvedValue({
        ...mockService,
        type: 'COMPOSE',
      } as any);

      await controller.restartService(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error:
          'Please use "Redeploy" for Docker Compose services to apply environment variables and configuration changes correctly.',
      });
    });
  });

  describe('streamDeploymentLogs', () => {
    it('should setup SSE stream for deployment logs', async () => {
      mockRequest.params = { id: 'deployment-1' };
      vi.mocked(mockDeploymentService.getDeployment).mockResolvedValue(mockDeployment);

      await controller.streamDeploymentLogs(mockRequest as any, mockReply as any);

      expect(mockDeploymentService.getDeployment).toHaveBeenCalledWith('deployment-1', 'user-1');
      expect(mockReply.raw?.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should return 404 when deployment not found', async () => {
      mockRequest.params = { id: 'deployment-1' };
      vi.mocked(mockDeploymentService.getDeployment).mockRejectedValue(
        new NotFoundError('Deployment not found'),
      );

      await controller.streamDeploymentLogs(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Deployment not found or unauthorized',
      });
    });
  });
});
