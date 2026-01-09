import { Job, Worker } from 'bullmq';
import { prisma } from 'database';
import Docker from 'dockerode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock implementations
const mockContainer = {
  id: 'mock-container-id',
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  inspect: vi.fn().mockResolvedValue({
    State: {
      Status: 'running',
      Running: true,
    },
  }),
  exec: vi.fn(),
  logs: vi.fn(),
};

const mockBuilder = {
  id: 'mock-builder-id',
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  inspect: vi.fn().mockResolvedValue({
    State: {
      Status: 'running',
      Running: true,
    },
  }),
  exec: vi.fn(),
};

const mockNewContainer = {
  id: 'mock-new-container-id',
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  inspect: vi.fn(),
};

const mockOldContainer = {
  Id: 'old-container-id',
  Names: ['/old-service-abc123'],
  State: 'running',
  Labels: {
    'helvetia.serviceId': 'service-123',
  },
};

let mockDockerInstance: {
  createContainer: ReturnType<typeof vi.fn>;
  listContainers: ReturnType<typeof vi.fn>;
  getContainer: ReturnType<typeof vi.fn>;
  pull: ReturnType<typeof vi.fn>;
  modem: { followProgress: ReturnType<typeof vi.fn> };
};

// Mock modules
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      subscribe: vi.fn(),
      removeListener: vi.fn(),
      quit: vi.fn(),
      publish: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('bullmq', () => {
  return {
    Worker: vi.fn().mockImplementation((queueName, processor) => {
      return {
        queueName,
        processor,
        close: vi.fn(),
      };
    }),
    Job: vi.fn(),
  };
});

vi.mock('database', () => {
  return {
    prisma: {
      deployment: {
        update: vi.fn().mockResolvedValue({ id: 'deployment-123' }),
      },
      service: {
        update: vi.fn().mockResolvedValue({ id: 'service-123' }),
      },
    },
  };
});

vi.mock('dockerode', () => {
  return {
    default: vi.fn().mockImplementation(() => mockDockerInstance),
  };
});

describe('Worker Failure Scenarios', () => {
  let worker: Worker;
  let jobProcessor: (job: Job) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock Docker instance
    mockDockerInstance = {
      createContainer: vi.fn(),
      listContainers: vi.fn().mockResolvedValue([]),
      getContainer: vi.fn(),
      pull: vi.fn(),
      modem: {
        followProgress: vi.fn((stream, callback) => {
          callback(null, []);
        }),
      },
    };

    // Re-import worker to get fresh instance with mocks
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const workerModule = require('./worker');
    worker = workerModule.worker;
    jobProcessor = worker.processor as (job: Job) => Promise<void>;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Build Failure Handling', () => {
    it('should cleanup builder container on build failure', async () => {
      // Setup: Build fails during execution
      const mockExec = {
        start: vi.fn().mockResolvedValue({
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from('Build error: npm install failed'));
            }
            if (event === 'end') {
              handler();
            }
          }),
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 1 }),
      };

      mockBuilder.exec.mockResolvedValue(mockExec);
      mockDockerInstance.createContainer.mockResolvedValueOnce(mockBuilder);

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'DOCKER',
          port: 3000,
        },
      } as Job;

      // Execute
      await expect(jobProcessor(job)).rejects.toThrow('Build failed with exit code 1');

      // Verify builder cleanup was attempted
      expect(mockBuilder.inspect).toHaveBeenCalled();
      expect(mockBuilder.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should log detailed error information on build failure', async () => {
      const mockExec = {
        start: vi.fn().mockResolvedValue({
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from('Error: Cannot find module'));
            }
            if (event === 'end') {
              handler();
            }
          }),
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 1 }),
      };

      mockBuilder.exec.mockResolvedValue(mockExec);
      mockDockerInstance.createContainer.mockResolvedValueOnce(mockBuilder);

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'DOCKER',
          port: 3000,
        },
      } as Job;

      await expect(jobProcessor(job)).rejects.toThrow();

      // Verify detailed logs were saved
      const deploymentUpdate = vi.mocked(prisma.deployment.update).mock.calls.find(
        (call) => call[0].data.status === 'FAILED',
      );
      expect(deploymentUpdate).toBeDefined();
      expect(deploymentUpdate![0].data.logs).toContain('DEPLOYMENT FAILURE');
      expect(deploymentUpdate![0].data.logs).toContain('BUILD LOGS');
    });
  });

  describe('Container Start Failure Handling', () => {
    it('should cleanup new container if start fails', async () => {
      // Setup: Container created but start fails
      const mockExec = {
        start: vi.fn().mockResolvedValue({
          on: vi.fn((event, handler) => {
            if (event === 'end') {
              handler();
            }
          }),
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };

      mockBuilder.exec.mockResolvedValue(mockExec);

      // Builder succeeds
      mockDockerInstance.createContainer.mockResolvedValueOnce(mockBuilder);

      // Old containers exist
      mockDockerInstance.listContainers
        .mockResolvedValueOnce([mockOldContainer]) // Initial check for old containers
        .mockResolvedValueOnce([]); // After new container starts

      // New container fails to start
      mockNewContainer.start.mockRejectedValueOnce(new Error('Port already in use'));
      mockDockerInstance.createContainer.mockResolvedValueOnce(mockNewContainer);

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'DOCKER',
          port: 3000,
        },
      } as Job;

      // Execute
      await expect(jobProcessor(job)).rejects.toThrow();

      // Verify new container cleanup
      expect(mockNewContainer.stop).toHaveBeenCalled();
      expect(mockNewContainer.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should attempt rollback to old containers on new container failure', async () => {
      const mockExec = {
        start: vi.fn().mockResolvedValue({
          on: vi.fn((event, handler) => {
            if (event === 'end') {
              handler();
            }
          }),
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };

      mockBuilder.exec.mockResolvedValue(mockExec);
      mockDockerInstance.createContainer.mockResolvedValueOnce(mockBuilder);

      // Mock old container that was running
      const oldContainerInstance = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: false },
        }),
        start: vi.fn().mockResolvedValue(undefined),
      };

      mockDockerInstance.listContainers
        .mockResolvedValueOnce([mockOldContainer])
        .mockResolvedValueOnce([]);

      mockDockerInstance.getContainer.mockReturnValue(oldContainerInstance);

      // New container creation fails
      mockDockerInstance.createContainer.mockRejectedValueOnce(new Error('Image not found'));

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'DOCKER',
          port: 3000,
        },
      } as Job;

      await expect(jobProcessor(job)).rejects.toThrow();

      // Verify rollback attempt
      expect(oldContainerInstance.inspect).toHaveBeenCalled();
      expect(oldContainerInstance.start).toHaveBeenCalled();

      // Verify service status set to RUNNING after rollback
      const serviceUpdate = vi.mocked(prisma.service.update).mock.calls.find(
        (call) => call[0].where.id === 'service-123',
      );
      expect(serviceUpdate).toBeDefined();
      expect(serviceUpdate![0].data.status).toBe('RUNNING');
    });
  });

  describe('Rollback Behavior', () => {
    it('should keep service as FAILED if no old containers exist', async () => {
      const mockExec = {
        start: vi.fn().mockResolvedValue({
          on: vi.fn((event, handler) => {
            if (event === 'end') {
              handler();
            }
          }),
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };

      mockBuilder.exec.mockResolvedValue(mockExec);
      mockDockerInstance.createContainer.mockResolvedValueOnce(mockBuilder);

      // No old containers
      mockDockerInstance.listContainers.mockResolvedValue([]);

      // New container creation fails
      mockDockerInstance.createContainer.mockRejectedValueOnce(
        new Error('Out of memory'),
      );

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'DOCKER',
          port: 3000,
        },
      } as Job;

      await expect(jobProcessor(job)).rejects.toThrow();

      // Verify service status set to FAILED (no rollback possible)
      const serviceUpdate = vi.mocked(prisma.service.update).mock.calls.find(
        (call) => call[0].where.id === 'service-123',
      );
      expect(serviceUpdate).toBeDefined();
      expect(serviceUpdate![0].data.status).toBe('FAILED');
    });

    it('should handle rollback failures gracefully', async () => {
      const mockExec = {
        start: vi.fn().mockResolvedValue({
          on: vi.fn((event, handler) => {
            if (event === 'end') {
              handler();
            }
          }),
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };

      mockBuilder.exec.mockResolvedValue(mockExec);
      mockDockerInstance.createContainer.mockResolvedValueOnce(mockBuilder);

      // Old container that fails to restart
      const oldContainerInstance = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: false },
        }),
        start: vi.fn().mockRejectedValue(new Error('Container corrupted')),
      };

      mockDockerInstance.listContainers
        .mockResolvedValueOnce([mockOldContainer])
        .mockResolvedValueOnce([]);

      mockDockerInstance.getContainer.mockReturnValue(oldContainerInstance);
      mockDockerInstance.createContainer.mockRejectedValueOnce(new Error('Build failed'));

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'DOCKER',
          port: 3000,
        },
      } as Job;

      // Should not throw additional error even if rollback fails
      await expect(jobProcessor(job)).rejects.toThrow('Build failed');

      // Verify rollback was attempted despite failure
      expect(oldContainerInstance.start).toHaveBeenCalled();
    });
  });

  describe('Builder Cleanup Edge Cases', () => {
    it('should force remove builder even if stop fails', async () => {
      mockBuilder.stop.mockRejectedValueOnce(new Error('Already stopped'));
      mockDockerInstance.createContainer.mockResolvedValueOnce(mockBuilder);

      // Fail early to trigger cleanup
      mockDockerInstance.listContainers.mockRejectedValueOnce(new Error('Docker daemon error'));

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'DOCKER',
          port: 3000,
        },
      } as Job;

      await expect(jobProcessor(job)).rejects.toThrow();

      // Verify force remove was still attempted
      expect(mockBuilder.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should attempt multiple removal strategies for builder', async () => {
      mockBuilder.inspect.mockResolvedValueOnce({
        State: { Status: 'running', Running: true },
      });
      mockBuilder.remove
        .mockRejectedValueOnce(new Error('Container is running'))
        .mockResolvedValueOnce(undefined);

      mockDockerInstance.createContainer.mockResolvedValueOnce(mockBuilder);
      mockDockerInstance.listContainers.mockRejectedValueOnce(new Error('Connection refused'));

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'DOCKER',
          port: 3000,
        },
      } as Job;

      await expect(jobProcessor(job)).rejects.toThrow();

      // Verify multiple removal attempts
      expect(mockBuilder.remove).toHaveBeenCalledTimes(2);
      expect(mockBuilder.remove).toHaveBeenNthCalledWith(1, { force: true });
      expect(mockBuilder.remove).toHaveBeenNthCalledWith(2, { force: true, v: true });
    });
  });

  describe('Database Update Failures', () => {
    it('should handle database update failures gracefully', async () => {
      vi.mocked(prisma.deployment.update).mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      mockDockerInstance.createContainer.mockRejectedValueOnce(new Error('Build error'));

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'DOCKER',
          port: 3000,
        },
      } as Job;

      // Should still throw the original error, not database error
      await expect(jobProcessor(job)).rejects.toThrow('Build error');

      // Verify database update was attempted
      expect(prisma.deployment.update).toHaveBeenCalled();
    });
  });

  describe('Compose Deployment Failures', () => {
    it('should cleanup builder on compose deployment failure', async () => {
      const mockExec = {
        start: vi.fn().mockResolvedValue({
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from('docker-compose up failed'));
            }
            if (event === 'end') {
              handler();
            }
          }),
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 1 }),
      };

      mockBuilder.exec.mockResolvedValue(mockExec);
      mockDockerInstance.createContainer.mockResolvedValueOnce(mockBuilder);

      const job = {
        data: {
          deploymentId: 'deployment-123',
          serviceId: 'service-123',
          repoUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          serviceName: 'test-service',
          type: 'COMPOSE',
          port: 3000,
        },
      } as Job;

      await expect(jobProcessor(job)).rejects.toThrow();

      // Verify builder cleanup
      expect(mockBuilder.remove).toHaveBeenCalledWith({ force: true });
    });
  });
});
