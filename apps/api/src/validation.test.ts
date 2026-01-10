import { beforeEach, describe, expect, it, vi } from 'vitest';

// We must mock BEFORE importing the server
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

vi.mock('database', () => {
  return {
    prisma: {
      service: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        upsert: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      deployment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
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

describe('Service Input Validation', () => {
  // Helper function to generate auth token
  const getAuthToken = () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    return fastify.jwt.sign(mockUser);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Wait for fastify to be ready to ensure JWT plugin is loaded
    await fastify.ready();
  });

  describe('POST /services - Service Creation Validation', () => {
    it('should reject service with name shorter than 3 characters', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'ab', // Too short
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details).toBeDefined();
      expect(json.details.some((d: any) => d.field === 'name')).toBe(true);
    });

    it('should reject service with name longer than 63 characters', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'a'.repeat(64), // Too long
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'name')).toBe(true);
    });

    it('should reject service with invalid name format (uppercase)', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'MyService', // Contains uppercase
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'name')).toBe(true);
    });

    it('should reject service with invalid name format (special characters)', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my_service!@#', // Contains invalid characters
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'name')).toBe(true);
    });

    it('should accept service with valid name format', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.service.upsert).mockResolvedValue({
        id: 'service-1',
        name: 'my-valid-service-123',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-valid-service-123', // Valid format
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject service with invalid repoUrl', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          repoUrl: 'not-a-valid-url', // Invalid URL
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'repoUrl')).toBe(true);
    });

    it('should accept service with valid repoUrl', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.service.upsert).mockResolvedValue({
        id: 'service-1',
        name: 'my-service',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          repoUrl: 'https://github.com/user/repo', // Valid URL
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject service with invalid branch name', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          branch: 'feature@branch!', // Invalid characters
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'branch')).toBe(true);
    });

    it('should accept service with valid branch name', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.service.upsert).mockResolvedValue({
        id: 'service-1',
        name: 'my-service',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          branch: 'feature/my-branch_123', // Valid branch name
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject service with too long buildCommand', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          buildCommand: 'a'.repeat(1001), // Too long
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'buildCommand')).toBe(true);
    });

    it('should reject service with too long startCommand', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          startCommand: 'a'.repeat(1001), // Too long
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'startCommand')).toBe(true);
    });

    it('should reject service with invalid port (too low)', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          port: 0, // Too low
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'port')).toBe(true);
    });

    it('should reject service with invalid port (too high)', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          port: 65536, // Too high
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'port')).toBe(true);
    });

    it('should accept service with valid port', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.service.upsert).mockResolvedValue({
        id: 'service-1',
        name: 'my-service',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          port: 8080, // Valid port
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject service with envVars exceeding size limit', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      // Create envVars that exceed 10KB but stay under 100KB body limit
      // 250 vars × 30 chars = ~10.4KB envVars, ~10.4KB total payload
      const largeEnvVars: Record<string, string> = {};
      for (let i = 0; i < 250; i++) {
        largeEnvVars[`VAR_${i}`] = 'x'.repeat(30);
      }

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          envVars: largeEnvVars,
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.message.includes('10KB'))).toBe(true);
    });

    it('should accept service with valid envVars', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.service.upsert).mockResolvedValue({
        id: 'service-1',
        name: 'my-service',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          envVars: {
            NODE_ENV: 'production',
            PORT: '3000',
          },
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject service with too long customDomain', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          customDomain: 'a'.repeat(256), // Too long
          type: 'DOCKER',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'customDomain')).toBe(true);
    });

    it('should reject service with too long staticOutputDir', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          staticOutputDir: 'a'.repeat(256), // Too long
          type: 'STATIC',
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'staticOutputDir')).toBe(true);
    });
  });

  describe('PATCH /services/:id - Service Update Validation', () => {
    it('should reject update with invalid name format', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findFirst).mockResolvedValue({
        id: 'service-1',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/services/service-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'Invalid_Name!', // Invalid format
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'name')).toBe(true);
    });

    it('should reject update with invalid repoUrl', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findFirst).mockResolvedValue({
        id: 'service-1',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/services/service-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          repoUrl: 'not-a-url', // Invalid URL
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'repoUrl')).toBe(true);
    });

    it('should reject update with invalid branch name', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findFirst).mockResolvedValue({
        id: 'service-1',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/services/service-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          branch: 'feature@branch!', // Invalid characters
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'branch')).toBe(true);
    });

    it('should reject update with invalid port', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findFirst).mockResolvedValue({
        id: 'service-1',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/services/service-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          port: 70000, // Out of range
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error).toBe('Validation failed');
      expect(json.details.some((d: any) => d.field === 'port')).toBe(true);
    });

    it('should accept valid update', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.service.findUnique).mockResolvedValue({
        id: 'service-1',
        name: 'updated-service',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/services/service-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'updated-service',
          branch: 'develop',
          port: 8080,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
