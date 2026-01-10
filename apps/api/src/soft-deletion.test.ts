import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fastify } from './server';

// Mock dependencies
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    subscribe: vi.fn(),
    removeListener: vi.fn(),
    quit: vi.fn(),
    defineCommand: vi.fn(),
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

vi.mock('dockerode', () => ({
  default: vi.fn(function () {
    return {
      listContainers: vi.fn().mockResolvedValue([]),
      listVolumes: vi.fn().mockResolvedValue({ Volumes: [] }),
      getContainer: vi.fn(),
      getImage: vi.fn(),
      getVolume: vi.fn(),
    };
  }),
}));

vi.mock('database', () => {
  return {
    prisma: {
      service: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
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
  };
});

describe('Soft Deletion Flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fastify.ready();
  });

  describe('DELETE /services/:id - Soft Deletion', () => {
    it('should soft delete a service by setting deletedAt timestamp', async () => {
      const { prisma } = await import('database');
      const serviceId = 'test-service-id';
      const userId = 'user-1';
      const mockService = {
        id: serviceId,
        name: 'test-app',
        userId,
        type: 'DOCKER',
        deletedAt: null,
        deleteProtected: false,
      };

      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
      vi.mocked(prisma.service.update).mockResolvedValue({
        ...mockService,
        deletedAt: new Date(),
      } as never);

      const token = fastify.jwt.sign({ id: userId });

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/services/${serviceId}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('soft deleted');

      // Verify soft deletion was called
      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: serviceId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should prevent deletion of protected services', async () => {
      const { prisma } = await import('database');
      const serviceId = 'protected-service';
      const userId = 'user-1';
      const mockService = {
        id: serviceId,
        name: 'protected-app',
        userId,
        type: 'DOCKER',
        deletedAt: null,
        deleteProtected: true,
      };

      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);

      const token = fastify.jwt.sign({ id: userId });

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/services/${serviceId}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('protected from deletion');

      // Verify service was not updated
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent service', async () => {
      const { prisma } = await import('database');
      const serviceId = 'non-existent';
      const userId = 'user-1';

      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = fastify.jwt.sign({ id: userId });

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/services/${serviceId}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /services/:id/recover - Recovery', () => {
    it('should recover a soft-deleted service', async () => {
      const { prisma } = await import('database');
      const serviceId = 'deleted-service';
      const userId = 'user-1';
      const deletedDate = new Date('2024-01-01');
      const mockService = {
        id: serviceId,
        name: 'deleted-app',
        userId,
        type: 'DOCKER',
        deletedAt: deletedDate,
        deleteProtected: false,
      };

      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
      vi.mocked(prisma.service.update).mockResolvedValue({
        ...mockService,
        deletedAt: null,
      } as never);

      const token = fastify.jwt.sign({ id: userId });

      const response = await fastify.inject({
        method: 'POST',
        url: `/services/${serviceId}/recover`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('recovered');

      // Verify recovery was called
      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: serviceId },
        data: { deletedAt: null },
      });
    });

    it('should return 404 when trying to recover non-deleted service', async () => {
      const { prisma } = await import('database');
      const serviceId = 'active-service';
      const userId = 'user-1';

      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = fastify.jwt.sign({ id: userId });

      const response = await fastify.inject({
        method: 'POST',
        url: `/services/${serviceId}/recover`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /services/:id/protection - Toggle Protection', () => {
    it('should enable delete protection', async () => {
      const { prisma } = await import('database');
      const serviceId = 'test-service';
      const userId = 'user-1';
      const mockService = {
        id: serviceId,
        name: 'test-app',
        userId,
        type: 'DOCKER',
        deletedAt: null,
        deleteProtected: false,
      };

      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
      vi.mocked(prisma.service.update).mockResolvedValue({
        ...mockService,
        deleteProtected: true,
      } as never);

      const token = fastify.jwt.sign({ id: userId });

      const response = await fastify.inject({
        method: 'PATCH',
        url: `/services/${serviceId}/protection`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { deleteProtected: true },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: serviceId },
        data: { deleteProtected: true },
      });
    });

    it('should disable delete protection', async () => {
      const { prisma } = await import('database');
      const serviceId = 'test-service';
      const userId = 'user-1';
      const mockService = {
        id: serviceId,
        name: 'test-app',
        userId,
        type: 'DOCKER',
        deletedAt: null,
        deleteProtected: true,
      };

      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
      vi.mocked(prisma.service.update).mockResolvedValue({
        ...mockService,
        deleteProtected: false,
      } as never);

      const token = fastify.jwt.sign({ id: userId });

      const response = await fastify.inject({
        method: 'PATCH',
        url: `/services/${serviceId}/protection`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { deleteProtected: false },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject invalid protection value', async () => {
      const { prisma } = await import('database');
      const serviceId = 'test-service';
      const userId = 'user-1';

      const token = fastify.jwt.sign({ id: userId });

      const response = await fastify.inject({
        method: 'PATCH',
        url: `/services/${serviceId}/protection`,
        headers: { Authorization: `Bearer ${token}` },
        payload: { deleteProtected: 'invalid' },
      });

      expect(response.statusCode).toBe(400);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });
  });

  describe('Service Queries - Filtering Deleted Services', () => {
    it('should exclude soft-deleted services from GET /services', async () => {
      const { prisma } = await import('database');
      const userId = 'user-1';

      const token = fastify.jwt.sign({ id: userId });

      await fastify.inject({
        method: 'GET',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
      });

      // Verify deletedAt filter was applied
      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('should exclude soft-deleted services from GET /services/:id', async () => {
      const { prisma } = await import('database');
      const serviceId = 'test-service';
      const userId = 'user-1';

      // Mock a soft-deleted service
      const mockService = {
        id: serviceId,
        name: 'test-app',
        userId,
        type: 'DOCKER',
        deletedAt: new Date(), // Soft deleted
        deleteProtected: false,
      };

      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
      vi.mocked(prisma.deployment.findMany).mockResolvedValue([] as never);

      const token = fastify.jwt.sign({ id: userId });

      const response = await fastify.inject({
        method: 'GET',
        url: `/services/${serviceId}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      // Should return 404 because service is soft-deleted
      expect(response.statusCode).toBe(404);
    });
  });
});
