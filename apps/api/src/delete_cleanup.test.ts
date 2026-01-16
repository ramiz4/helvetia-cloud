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

const { mockContainer, mockDocker } = vi.hoisted(() => {
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
  return { mockContainer, mockImage, mockVolume, mockDocker };
});

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
        create: vi.fn(),
        update: vi.fn(),
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
    PrismaClient: vi.fn(),
    Role: {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      DEVELOPER: 'DEVELOPER',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    },
  };
});

describe('Service Deletion Cleanup', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fastify.ready();
  });

  it('should soft delete a service without removing Docker resources', async () => {
    const { prisma } = await import('database');
    const serviceId = 'test-service-id';
    const mockService = {
      id: serviceId,
      name: 'test-app',
      userId: 'user-1',
      type: 'DOCKER',
      deletedAt: null,
      deleteProtected: false,
    };

    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
    vi.mocked(prisma.service.update).mockResolvedValue({
      ...mockService,
      deletedAt: new Date(),
    } as never);

    const token = fastify.jwt.sign({ id: 'user-1' });

    const response = await fastify.inject({
      method: 'DELETE',
      url: `/api/v1/services/${serviceId}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.message).toContain('soft deleted');

    // Verify soft deletion was called (update, not delete)
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: serviceId },
      data: { deletedAt: expect.any(Date) },
    });

    // Verify Docker resources were NOT touched (soft delete doesn't clean up immediately)
    expect(mockDocker.getContainer).not.toHaveBeenCalled();
    expect(mockContainer.stop).not.toHaveBeenCalled();
    expect(mockContainer.remove).not.toHaveBeenCalled();
  });

  it('should soft delete a COMPOSE service', async () => {
    const { prisma } = await import('database');
    const serviceId = 'compose-service-id';
    const mockService = {
      id: serviceId,
      name: 'my-compose-app',
      userId: 'user-1',
      type: 'COMPOSE',
      deletedAt: null,
      deleteProtected: false,
    };

    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
    vi.mocked(prisma.service.update).mockResolvedValue({
      ...mockService,
      deletedAt: new Date(),
    } as never);

    const token = fastify.jwt.sign({ id: 'user-1' });

    const response = await fastify.inject({
      method: 'DELETE',
      url: `/api/v1/services/${serviceId}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    // Verify soft deletion, not hard deletion
    expect(prisma.service.update).toHaveBeenCalled();
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });
});
