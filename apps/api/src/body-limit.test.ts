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
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
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

vi.mock('axios', () => {
  return {
    default: {
      post: vi.fn(),
      get: vi.fn(),
    },
  };
});

import { BODY_LIMIT_GLOBAL, BODY_LIMIT_SMALL, BODY_LIMIT_STANDARD, fastify } from './server';

describe('Request Body Size Limits', () => {
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

  describe('Body Limit Constants', () => {
    it('should have correct body limit values', () => {
      expect(BODY_LIMIT_GLOBAL).toBe(10 * 1024 * 1024); // 10MB
      expect(BODY_LIMIT_STANDARD).toBe(1 * 1024 * 1024); // 1MB
      expect(BODY_LIMIT_SMALL).toBe(100 * 1024); // 100KB
    });
  });

  describe('POST /services - Body Size Limit (100KB)', () => {
    it('should reject request with body exceeding 100KB limit', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);

      const token = getAuthToken();

      // Create a payload that exceeds 100KB
      const largeEnvVars: Record<string, string> = {};
      // Each entry is roughly 20 bytes, so we need about 5500 entries for 110KB
      for (let i = 0; i < 5500; i++) {
        largeEnvVars[`VAR_${i}`] = `value_${i}`;
      }

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          type: 'DOCKER',
          envVars: largeEnvVars,
        },
      });

      expect(response.statusCode).toBe(413);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.statusCode).toBe(413);

      expect(json.error.message).toContain('exceeds the maximum allowed size');
    });

    it('should accept request with body under 100KB limit', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.service.upsert).mockResolvedValue({
        id: 'service-1',
        name: 'my-service',
        userId: 'user-1',
        type: 'DOCKER',
      } as any);

      const token = getAuthToken();

      // Create a reasonable payload under 100KB
      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          type: 'DOCKER',
          repoUrl: 'https://github.com/user/repo',
          branch: 'main',
          envVars: {
            NODE_ENV: 'production',
            PORT: '3000',
          },
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('PATCH /services/:id - Body Size Limit (100KB)', () => {
    it('should reject request with body exceeding 100KB limit', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findFirst).mockResolvedValue({
        id: 'service-1',
        userId: 'user-1',
      } as any);

      const token = getAuthToken();

      // Create a payload that exceeds 100KB
      const largeEnvVars: Record<string, string> = {};
      for (let i = 0; i < 5500; i++) {
        largeEnvVars[`VAR_${i}`] = `value_${i}`;
      }

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/services/service-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          envVars: largeEnvVars,
        },
      });

      expect(response.statusCode).toBe(413);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.statusCode).toBe(413);

      expect(json.error.message).toContain('exceeds the maximum allowed size');
    });

    it('should accept request with body under 100KB limit', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.service.findUnique).mockResolvedValue({
        id: 'service-1',
        name: 'my-service',
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
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /auth/github - Body Size Limit (100KB)', () => {
    it('should reject request with body exceeding 100KB limit', async () => {
      const axios = (await import('axios')).default;
      vi.mocked(axios.post).mockResolvedValue({ data: { access_token: 'token' } });
      vi.mocked(axios.get).mockResolvedValue({
        data: { id: 123, login: 'testuser', avatar_url: 'url' },
      });

      const { prisma } = await import('database');
      vi.mocked(prisma.user.upsert).mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        githubId: '123',
        avatarUrl: 'url',
      } as any);

      // Create a payload that exceeds 100KB (very unlikely for auth, but test anyway)
      const largeCode = 'a'.repeat(110 * 1024);

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/github',
        payload: {
          code: largeCode,
        },
      });

      expect(response.statusCode).toBe(413);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.statusCode).toBe(413);
    });

    it('should accept request with body under 100KB limit', async () => {
      const axios = (await import('axios')).default;
      vi.mocked(axios.post).mockResolvedValue({ data: { access_token: 'token' } });
      vi.mocked(axios.get).mockResolvedValue({
        data: { id: 123, login: 'testuser', avatar_url: 'url' },
      });

      const { prisma } = await import('database');
      vi.mocked(prisma.user.upsert).mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        githubId: '123',
        avatarUrl: 'url',
      } as any);

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/github',
        payload: {
          code: 'github-auth-code',
        },
      });

      // Should succeed or fail for other reasons (not body size)
      expect(response.statusCode).not.toBe(413);
    });
  });

  describe('POST /webhooks/github - Body Size Limit (1MB)', () => {
    it('should reject webhook payload exceeding 1MB limit', async () => {
      // Create a very large webhook payload (> 1MB)
      const largePayload = {
        repository: { html_url: 'https://github.com/user/repo' },
        ref: 'refs/heads/main',
        after: 'commit-hash',
        commits: Array(50000).fill({
          id: 'commit-id',
          message: 'a'.repeat(50),
          author: { name: 'Author', email: 'author@example.com' },
        }),
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': 'sha256=fakesignature',
          'content-type': 'application/json',
        },
        payload: largePayload,
      });

      expect(response.statusCode).toBe(413);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.statusCode).toBe(413);
    });

    it('should accept webhook payload under 1MB limit', async () => {
      const { prisma } = await import('database');
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      // Normal webhook payload
      const normalPayload = {
        repository: { html_url: 'https://github.com/user/repo' },
        ref: 'refs/heads/main',
        after: 'commit-hash',
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': 'sha256=fakesignature',
          'content-type': 'application/json',
        },
        payload: normalPayload,
      });

      // Should fail for other reasons (invalid signature), not body size
      expect(response.statusCode).not.toBe(413);
    });
  });

  describe('Error Response Format', () => {
    it('should return properly formatted error for body too large', async () => {
      const token = getAuthToken();

      // Create a payload that exceeds 100KB for /services endpoint
      const largeEnvVars: Record<string, string> = {};
      for (let i = 0; i < 5500; i++) {
        largeEnvVars[`VAR_${i}`] = `value_${i}`;
      }

      const response = await fastify.inject({
        method: 'POST',
        url: '/services',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          name: 'my-service',
          type: 'DOCKER',
          envVars: largeEnvVars,
        },
      });

      const json = response.json();

      // Verify error response structure
      expect(json).toHaveProperty('success', false);
      expect(json).toHaveProperty('error');
      expect(json.error).toHaveProperty('statusCode', 413);
      expect(json.error).toHaveProperty('message');
      expect(typeof json.error.message).toBe('string');
      expect(json.error.message).toContain('exceeds the maximum allowed size');
    });
  });

  describe('Global Body Limit (10MB)', () => {
    it('should reject any request exceeding global 10MB limit', async () => {
      // This would be hard to test with actual 10MB payload in unit tests
      // but we verify the configuration is set
      expect(fastify.initialConfig.bodyLimit).toBe(BODY_LIMIT_GLOBAL);
    });
  });
});
