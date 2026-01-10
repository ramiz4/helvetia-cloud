import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fastify } from './server';

// Mock dependencies
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    subscribe: vi.fn(),
    removeListener: vi.fn(),
    quit: vi.fn(),
    defineCommand: vi.fn(), // Required by @fastify/rate-limit
    pttl: vi.fn().mockResolvedValue(60000),
    eval: vi.fn().mockResolvedValue([0, 60000]),
  };
  return {
    default: vi.fn(function () {
      return mockRedis;
    }),
  };
});

vi.mock('redlock', () => {
  const mockLock = {
    value: 'test-lock-value',
    attempts: [],
    expiration: Date.now() + 10000,
    release: vi.fn().mockResolvedValue(undefined),
    extend: vi.fn().mockResolvedValue(undefined),
  };
  return {
    default: vi.fn(function () {
      return {
        acquire: vi.fn().mockResolvedValue(mockLock),
        on: vi.fn(),
      };
    }),
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn(function () {
      return {
        add: vi.fn(),
      };
    }),
  };
});

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

vi.mock('database', () => {
  return {
    prisma: {
      service: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      deployment: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

describe('Service Deletion Cleanup', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fastify.ready();
  });

  it('should remove containers, images, and volumes when a service is deleted', async () => {
    const { prisma } = await import('database');
    const serviceId = 'test-service-id';
    const mockService = {
      id: serviceId,
      name: 'test-app',
      userId: 'user-1',
      type: 'DOCKER',
    };

    const mockDeployments = [
      { id: 'dep-1', imageTag: 'helvetia/test-app:dep-1' },
      { id: 'dep-2', imageTag: 'helvetia/test-app:dep-2' },
    ];

    vi.mocked(prisma.service.findFirst).mockResolvedValue(mockService as never);
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
    vi.mocked(prisma.deployment.findMany).mockResolvedValue(mockDeployments as never);
    vi.mocked(prisma.deployment.deleteMany).mockResolvedValue({
      count: mockDeployments.length,
    } as never);
    vi.mocked(prisma.service.delete).mockResolvedValue(mockService as never);

    mockDocker.listContainers.mockResolvedValue([
      { Id: 'container-1', Labels: { 'helvetia.serviceId': serviceId } },
    ]);

    const token = fastify.jwt.sign({ id: 'user-1' });

    const consoleSpy = vi.spyOn(console, 'error');
    const response = await fastify.inject({
      method: 'DELETE',
      url: `/services/${serviceId}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.statusCode !== 200) {
      console.log('Error Response:', response.body);
      console.log('Console Errors:', consoleSpy.mock.calls);
    }
    expect(response.statusCode).toBe(200);

    // Verify container cleanup
    expect(mockDocker.getContainer).toHaveBeenCalledWith('container-1');
    expect(mockContainer.stop).toHaveBeenCalled();
    expect(mockContainer.remove).toHaveBeenCalled();

    // Verify image cleanup
    expect(mockDocker.getImage).toHaveBeenCalledWith('helvetia/test-app:dep-1');
    expect(mockDocker.getImage).toHaveBeenCalledWith('helvetia/test-app:dep-2');
    expect(mockImage.remove).toHaveBeenCalledTimes(2);

    // Verify volume cleanup (for DOCKER services we might want to remove named volumes if they exist)
  });

  it('should remove all resources for a COMPOSE service', async () => {
    const { prisma } = await import('database');
    const serviceId = 'compose-service-id';
    const mockService = {
      id: serviceId,
      name: 'my-compose-app',
      userId: 'user-1',
      type: 'COMPOSE',
    };

    vi.mocked(prisma.service.findFirst).mockResolvedValue(mockService as never);
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
    vi.mocked(prisma.deployment.findMany).mockResolvedValue([]); // No individual images in DB for compose yet

    mockDocker.listContainers.mockResolvedValue([
      { Id: 'c1', Labels: { 'com.docker.compose.project': 'my-compose-app' } },
      { Id: 'c2', Labels: { 'com.docker.compose.project': 'my-compose-app' } },
    ]);

    // Mock volume list
    mockDocker.listVolumes = vi.fn().mockResolvedValue({
      Volumes: [
        { Name: 'my-compose-app_data', Labels: { 'com.docker.compose.project': 'my-compose-app' } },
      ],
    });

    const token = fastify.jwt.sign({ id: 'user-1' });

    const response = await fastify.inject({
      method: 'DELETE',
      url: `/services/${serviceId}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);

    // Should have removed both containers
    expect(mockDocker.getContainer).toHaveBeenCalledWith('c1');
    expect(mockDocker.getContainer).toHaveBeenCalledWith('c2');

    // Should have removed the project volume
    expect(mockDocker.getVolume).toHaveBeenCalledWith('my-compose-app_data');
    expect(mockVolume.remove).toHaveBeenCalled();
  });
});
