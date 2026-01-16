import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We must mock BEFORE importing the server
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

vi.mock('database', () => {
  return {
    prisma: {
      service: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      deployment: {
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

vi.mock('dockerode', () => {
  return {
    default: vi.fn(function () {
      return {
        listContainers: vi.fn().mockResolvedValue([]),
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

import { fastify, getAllowedOrigins, getSafeOrigin, isOriginAllowed } from './server';

describe('CORS Security', () => {
  const originalEnv = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv) {
      process.env.ALLOWED_ORIGINS = originalEnv;
    } else {
      delete process.env.ALLOWED_ORIGINS;
    }
  });

  describe('CORS Configuration', () => {
    it('should allow requests from allowed origin', async () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from disallowed origin', async () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://malicious-site.com',
        },
      });

      // Fastify CORS returns 500 when origin is not allowed
      expect(response.statusCode).toBe(500);
      const json = response.json();
      expect(json).toHaveProperty('error');
      expect(json.success).toBe(false);
    });

    it('should allow requests with no origin (same-origin or curl)', async () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    });

    it('should support multiple allowed origins', async () => {
      process.env.ALLOWED_ORIGINS =
        'http://localhost:3000,https://app.example.com,https://staging.example.com';

      const response1 = await fastify.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      const response2 = await fastify.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'https://app.example.com',
        },
      });

      const response3 = await fastify.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'https://staging.example.com',
        },
      });

      const response4 = await fastify.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://malicious.com',
        },
      });

      expect(response1.statusCode).toBe(200);
      expect(response1.headers['access-control-allow-origin']).toBe('http://localhost:3000');

      expect(response2.statusCode).toBe(200);
      expect(response2.headers['access-control-allow-origin']).toBe('https://app.example.com');

      expect(response3.statusCode).toBe(200);
      expect(response3.headers['access-control-allow-origin']).toBe('https://staging.example.com');

      // Fastify CORS returns 500 for disallowed origins
      expect(response4.statusCode).toBe(500);
    });

    it('should fallback to APP_BASE_URL if ALLOWED_ORIGINS is not set', async () => {
      delete process.env.ALLOWED_ORIGINS;
      process.env.APP_BASE_URL = 'http://localhost:3000';

      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should handle whitespace in ALLOWED_ORIGINS', async () => {
      process.env.ALLOWED_ORIGINS = ' http://localhost:3000 , https://app.example.com ';

      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'https://app.example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');
    });

    it('should use default origin when env vars are missing', () => {
      // Temporarily clear the configuration
      const originalAllowed = process.env.ALLOWED_ORIGINS;
      const originalBase = process.env.APP_BASE_URL;

      delete process.env.ALLOWED_ORIGINS;
      delete process.env.APP_BASE_URL;

      // Should fall back to default localhost:3000
      const origins = getAllowedOrigins();
      expect(origins).toEqual(['http://localhost:3000']);

      const safeOrigin = getSafeOrigin('http://malicious.com');
      expect(safeOrigin).toBe('http://localhost:3000');

      // Restore
      if (originalAllowed) process.env.ALLOWED_ORIGINS = originalAllowed;
      if (originalBase) process.env.APP_BASE_URL = originalBase;
    });

    it('should NOT allow wildcard origin', async () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: '*',
        },
      });

      // Fastify CORS returns 500 for disallowed origins
      expect(response.statusCode).toBe(500);
    });
  });

  describe('SSE Endpoints Security', () => {
    it('should reject SSE requests from disallowed origins via CORS', async () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      const maliciousOrigin = 'http://evil.com';

      // CORS should block this request at the framework level
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          Authorization: `Bearer ${token}`,
          origin: maliciousOrigin,
        },
      });

      // Fastify CORS blocks disallowed origins with 500
      expect(response.statusCode).toBe(500);
    });
  });

  describe('Security - No Wildcard Origins', () => {
    it('should validate that wildcard origins are not in allowed list', () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

      // Verify the helper functions don't allow wildcards
      const allowedOrigins = getAllowedOrigins();
      expect(allowedOrigins).not.toContain('*');

      expect(isOriginAllowed('*')).toBe(false);
      expect(isOriginAllowed('http://attacker.com')).toBe(false);
      expect(isOriginAllowed('http://localhost:3000')).toBe(true);

      expect(getSafeOrigin('*')).toBe('http://localhost:3000');
      expect(getSafeOrigin('http://attacker.com')).toBe('http://localhost:3000');
      expect(getSafeOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    });
  });
});
