/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Docker
const mockContainer = {
  stop: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
};

const mockImage = {
  remove: vi.fn().mockResolvedValue(undefined),
};

const mockVolume = {
  remove: vi.fn().mockResolvedValue(undefined),
};

const mockDocker = {
  listContainers: vi.fn().mockResolvedValue([]),
  listVolumes: vi.fn().mockResolvedValue({ Volumes: [] }),
  getContainer: vi.fn(() => mockContainer),
  getImage: vi.fn(() => mockImage),
  getVolume: vi.fn(() => mockVolume),
};

vi.mock('dockerode', () => ({
  default: vi.fn(function () {
    return mockDocker;
  }),
}));

// Mock Redis
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    subscribe: vi.fn(),
    removeListener: vi.fn(),
    quit: vi.fn(),
  };
  return {
    default: vi.fn(function () {
      return mockRedis;
    }),
  };
});

// Mock BullMQ
vi.mock('bullmq', () => {
  return {
    Queue: vi.fn(function () {
      return {
        add: vi.fn().mockResolvedValue({ id: 'job-id' }),
      };
    }),
    Worker: vi.fn(function (name, processor) {
      return {
        name,
        processor,
        close: vi.fn(),
      };
    }),
  };
});

// Mock Prisma
const mockPrisma = {
  service: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  deployment: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock('database', () => ({
  prisma: mockPrisma,
}));

// Mock image cleanup service
const mockCleanupResult = {
  danglingImagesRemoved: 2,
  oldImagesRemoved: 3,
  bytesFreed: 1024 * 1024 * 500, // 500 MB
  errors: [],
};

vi.mock('./services/imageCleanup', () => ({
  cleanupDockerImages: vi.fn().mockResolvedValue(mockCleanupResult),
}));

describe('Service Cleanup Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should permanently delete services older than 30 days', async () => {
    // Import after mocks are set up
    const { cleanupWorker } = await import('./cleanup');

    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

    const oldDeletedService = {
      id: 'old-service-id',
      name: 'old-deleted-app',
      userId: 'user-1',
      type: 'DOCKER',
      deletedAt: thirtyOneDaysAgo,
    };

    mockPrisma.service.findMany.mockResolvedValue([oldDeletedService]);
    mockPrisma.service.findUnique.mockResolvedValue(oldDeletedService);
    mockPrisma.deployment.findMany.mockResolvedValue([
      { id: 'dep-1', imageTag: 'helvetia/old-deleted-app:latest' },
    ]);
    mockPrisma.deployment.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.service.delete.mockResolvedValue(oldDeletedService);

    mockDocker.listContainers.mockResolvedValue([
      {
        Id: 'container-1',
        Names: ['/container-1'],
        Labels: { 'helvetia.serviceId': 'old-service-id' },
      },
    ]);

    // Execute the worker processor
    const result = await cleanupWorker.processor({
      id: 'job-1',
      name: 'daily-cleanup',
      data: {},
    } as any);

    expect(result.deletedCount).toBe(1);
    expect(result.imageCleanup).toBeDefined();
    expect(result.imageCleanup.danglingImagesRemoved).toBe(2);
    expect(result.imageCleanup.oldImagesRemoved).toBe(3);

    // Verify services older than 30 days were queried
    expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: expect.objectContaining({
            not: null,
            lt: expect.any(Date),
          }),
        }),
      }),
    );

    // Verify service was deleted
    expect(mockPrisma.service.delete).toHaveBeenCalledWith({
      where: { id: 'old-service-id' },
    });

    // Verify Docker resources were cleaned up
    expect(mockDocker.getContainer).toHaveBeenCalledWith('container-1');
    expect(mockContainer.stop).toHaveBeenCalled();
    expect(mockContainer.remove).toHaveBeenCalled();
    expect(mockImage.remove).toHaveBeenCalled();
  });

  it('should not delete services deleted less than 30 days ago', async () => {
    const { cleanupWorker } = await import('./cleanup');

    // Return empty array - no services older than 30 days
    mockPrisma.service.findMany.mockResolvedValue([]);

    const result = await cleanupWorker.processor({
      id: 'job-2',
      name: 'daily-cleanup',
      data: {},
    } as any);

    expect(result.deletedCount).toBe(0);

    // Verify no services were deleted
    expect(mockPrisma.service.delete).not.toHaveBeenCalled();
  });

  it('should handle cleanup errors gracefully', async () => {
    const { cleanupWorker } = await import('./cleanup');

    const serviceWithError = {
      id: 'error-service-id',
      name: 'error-app',
      userId: 'user-1',
      type: 'DOCKER',
      deletedAt: new Date('2020-01-01'),
    };

    mockPrisma.service.findMany.mockResolvedValue([serviceWithError]);
    mockPrisma.service.findUnique.mockResolvedValue(serviceWithError);
    mockPrisma.deployment.findMany.mockRejectedValue(new Error('Database error'));

    // Should not throw, but log the error
    const result = await cleanupWorker.processor({
      id: 'job-3',
      name: 'daily-cleanup',
      data: {},
    } as any);

    // Should still return count even if individual deletions fail
    expect(result.deletedCount).toBe(1);
  });

  it('should clean up COMPOSE service volumes', async () => {
    const { cleanupWorker } = await import('./cleanup');

    const composeService = {
      id: 'compose-service-id',
      name: 'compose-app',
      userId: 'user-1',
      type: 'COMPOSE',
      deletedAt: new Date('2020-01-01'),
    };

    mockPrisma.service.findMany.mockResolvedValue([composeService]);
    mockPrisma.service.findUnique.mockResolvedValue(composeService);
    mockPrisma.deployment.findMany.mockResolvedValue([]);
    mockPrisma.deployment.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.service.delete.mockResolvedValue(composeService);

    mockDocker.listContainers.mockResolvedValue([
      { Id: 'c1', Names: ['/c1'], Labels: { 'com.docker.compose.project': 'compose-app' } },
    ]);

    mockDocker.listVolumes.mockResolvedValue({
      Volumes: [
        { Name: 'compose-app_data', Labels: { 'com.docker.compose.project': 'compose-app' } },
      ],
    });

    await cleanupWorker.processor({
      id: 'job-4',
      name: 'daily-cleanup',
      data: {},
    } as any);

    // Verify compose volume cleanup
    expect(mockDocker.listVolumes).toHaveBeenCalled();
    expect(mockDocker.getVolume).toHaveBeenCalledWith('compose-app_data');
    expect(mockVolume.remove).toHaveBeenCalled();
  });

  it('should schedule cleanup job with correct cron pattern', async () => {
    const { scheduleCleanupJob, cleanupQueue } = await import('./cleanup');

    await scheduleCleanupJob();

    expect(cleanupQueue.add).toHaveBeenCalledWith(
      'daily-cleanup',
      {},
      expect.objectContaining({
        repeat: expect.objectContaining({
          pattern: '0 2 * * *', // 2 AM daily
        }),
      }),
    );
  });

  it('should cleanup Docker images during scheduled job', async () => {
    const { cleanupWorker } = await import('./cleanup');
    const { cleanupDockerImages } = await import('./services/imageCleanup');

    mockPrisma.service.findMany.mockResolvedValue([]);

    const result = await cleanupWorker.processor({
      id: 'job-5',
      name: 'daily-cleanup',
      data: {},
    } as any);

    // Verify image cleanup was called
    expect(cleanupDockerImages).toHaveBeenCalled();
    expect(result.imageCleanup).toBeDefined();
    expect(result.imageCleanup.danglingImagesRemoved).toBeGreaterThanOrEqual(0);
    expect(result.imageCleanup.oldImagesRemoved).toBeGreaterThanOrEqual(0);
  });

  it('should handle image cleanup errors gracefully', async () => {
    const { cleanupWorker } = await import('./cleanup');
    const { cleanupDockerImages } = await import('./services/imageCleanup');

    mockPrisma.service.findMany.mockResolvedValue([]);
    (cleanupDockerImages as any).mockRejectedValueOnce(new Error('Docker daemon error'));

    const result = await cleanupWorker.processor({
      id: 'job-6',
      name: 'daily-cleanup',
      data: {},
    } as any);

    // Should still complete despite image cleanup error
    expect(result.deletedCount).toBe(0);
    expect(result.imageCleanup).toBeDefined();
    expect(result.imageCleanup.errors).toContain('Docker daemon error');
  });
});
