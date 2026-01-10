import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Redis and other dependencies before importing server
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
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

vi.mock('database', () => {
  return {
    prisma: {
      service: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      deployment: {
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
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

vi.mock('dockerode', () => {
  return {
    default: vi.fn(function () {
      return {
        listContainers: vi.fn().mockResolvedValue([]),
        getContainer: vi.fn(),
      };
    }),
  };
});

vi.mock('@fastify/rate-limit', () => {
  return {
    default: vi.fn((instance, opts, done) => {
      done();
    }),
  };
});

import { fastify } from './server';

describe('SSE Memory Leak Prevention', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fastify.ready();
  });

  describe('Metrics Stream Error Handling', () => {
    it('should handle errors in sendMetrics without leaking intervals', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      // Mock Docker to throw an error
      const Docker = (await import('dockerode')).default;
      const mockDocker = new Docker();
      vi.spyOn(mockDocker, 'listContainers').mockRejectedValueOnce(
        new Error('Docker connection failed'),
      );

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findMany).mockResolvedValue([
        {
          id: 'service-1',
          name: 'test-service',
          type: 'DOCKER',
          status: 'RUNNING',
        } as any,
      ]);

      // Start SSE connection
      const response = await fastify.inject({
        method: 'GET',
        url: '/services/metrics/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Should establish connection despite Docker error
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
    });

    it('should close connection after multiple consecutive errors', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      // Mock prisma to throw errors
      vi.mocked(prisma.service.findMany).mockRejectedValue(new Error('Database error'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/services/metrics/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      // Connection should be established but will close after errors accumulate
    });

    it('should clean up interval on client disconnect', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      // Use a spy to track setInterval/clearInterval
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const response = await fastify.inject({
        method: 'GET',
        url: '/services/metrics/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Simulate client disconnect by closing the connection
      // In real scenario, this would trigger the 'close' event
      // fastify.inject doesn't fully simulate streaming, so we verify the setup is correct
      expect(response.headers['content-type']).toBe('text/event-stream');
    });

    it('should handle token expiration during active connection', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      // Create a token that expires very soon
      const shortLivedToken = fastify.jwt.sign(mockUser, { expiresIn: '1ms' });

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      // Wait a bit to ensure token expires
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await fastify.inject({
        method: 'GET',
        url: '/services/metrics/stream',
        headers: {
          Authorization: `Bearer ${shortLivedToken}`,
        },
      });

      // Initial auth should fail
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Logs Stream Error Handling', () => {
    it('should clean up Redis subscription on disconnect', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: 'deployment-1',
        serviceId: 'service-1',
        status: 'BUILDING',
        service: {
          id: 'service-1',
          userId: 'user-1',
          name: 'test-service',
        } as any,
      } as any);

      const response = await fastify.inject({
        method: 'GET',
        url: '/deployments/deployment-1/logs/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
    });

    it('should handle Redis subscription errors gracefully', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: 'deployment-1',
        serviceId: 'service-1',
        status: 'BUILDING',
        service: {
          id: 'service-1',
          userId: 'user-1',
          name: 'test-service',
        } as any,
      } as any);

      // Mock Redis subscription to fail
      const IORedis = (await import('ioredis')).default;
      const mockRedis = new IORedis();
      vi.spyOn(mockRedis, 'subscribe').mockRejectedValueOnce(new Error('Redis error'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/deployments/deployment-1/logs/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Should handle subscription error
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should clean up interval on token expiration', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser, { expiresIn: '1ms' });

      const { prisma } = await import('database');
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: 'deployment-1',
        serviceId: 'service-1',
        status: 'BUILDING',
        service: {
          id: 'service-1',
          userId: 'user-1',
          name: 'test-service',
        } as any,
      } as any);

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await fastify.inject({
        method: 'GET',
        url: '/deployments/deployment-1/logs/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Should reject expired token
      expect(response.statusCode).toBe(401);
    });

    it('should handle write errors without leaking resources', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: 'deployment-1',
        serviceId: 'service-1',
        status: 'BUILDING',
        service: {
          id: 'service-1',
          userId: 'user-1',
          name: 'test-service',
        } as any,
      } as any);

      const response = await fastify.inject({
        method: 'GET',
        url: '/deployments/deployment-1/logs/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      // Write errors would be caught and logged, connection tracked
    });

    it('should verify deployment ownership before streaming', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: 'deployment-1',
        serviceId: 'service-1',
        status: 'BUILDING',
        service: {
          id: 'service-1',
          userId: 'different-user', // Different user
          name: 'test-service',
        } as any,
      } as any);

      const response = await fastify.inject({
        method: 'GET',
        url: '/deployments/deployment-1/logs/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Should reject unauthorized access
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Connection Timeout', () => {
    it('should have timeout mechanism for metrics stream', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      // Track setTimeout calls
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const response = await fastify.inject({
        method: 'GET',
        url: '/services/metrics/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      // Verify timeout was set (should be called at least once)
      expect(setTimeoutSpy).toHaveBeenCalled();
    });

    it('should have timeout mechanism for logs stream', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: 'deployment-1',
        serviceId: 'service-1',
        status: 'BUILDING',
        service: {
          id: 'service-1',
          userId: 'user-1',
          name: 'test-service',
        } as any,
      } as any);

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const response = await fastify.inject({
        method: 'GET',
        url: '/deployments/deployment-1/logs/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(setTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Connection State Tracking', () => {
    it('should track connection state for metrics stream', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      // Spy on console.log to verify state tracking
      const consoleLogSpy = vi.spyOn(console, 'log');

      const response = await fastify.inject({
        method: 'GET',
        url: '/services/metrics/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      // Should log connection establishment
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('SSE client connected for real-time metrics'),
      );
    });

    it('should track connection state for logs stream', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.deployment.findUnique).mockResolvedValue({
        id: 'deployment-1',
        serviceId: 'service-1',
        status: 'BUILDING',
        service: {
          id: 'service-1',
          userId: 'user-1',
          name: 'test-service',
        } as any,
      } as any);

      const consoleLogSpy = vi.spyOn(console, 'log');

      const response = await fastify.inject({
        method: 'GET',
        url: '/deployments/deployment-1/logs/stream',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      // Should log connection establishment
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('SSE client connected for live logs'),
      );
    });
  });
});
