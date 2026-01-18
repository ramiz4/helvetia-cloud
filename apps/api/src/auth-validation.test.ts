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
  return {
    default: vi.fn(function () {
      return {
        acquire: vi.fn().mockResolvedValue({
          release: vi.fn().mockResolvedValue(undefined),
        }),
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
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
    },
    PrismaClient: vi.fn(),
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

describe('Auth Route Validation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fastify.ready();
  });

  describe('POST /auth/login', () => {
    it('should accept login with username and password', async () => {
      // Mock the service to avoid actual DB hits, although validation happens before service call
      // The controller will be called if validation passes
      const { prisma } = await import('database');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        username: 'admin',
        password: '$2b$10$hashedpassword',
        role: 'ADMIN',
      } as any);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'admin',
          password: 'password123',
        },
      });

      // We expect 200 (if mocks work) or at least NOT 400 (Validation failed)
      // Since we updated the schema to use username, this should pass validation
      expect(response.statusCode).not.toBe(400);
    });

    it('should reject login if email is provided instead of username', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'password123',
        },
      });

      // Should be 400 because 'username' is required and 'email' is not in the schema
      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_FAILED');
      // Verify that 'username' is the missing property
      expect(JSON.stringify(json.error.details)).toContain('username');
    });

    it('should reject login if password is missing', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'admin',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
