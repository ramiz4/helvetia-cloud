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
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'admin',
          password: 'password123',
        },
      });

      // Schema validation should pass (not 400)
      // This test verifies that the schema validation accepts username/password format
      // We expect either 401 (authentication failure) or 500 (service error), but NOT 400 (validation error)
      expect(response.statusCode).not.toBe(400);
    });

    it('should accept login with email and password', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'password123',
        },
      });

      // Schema validation should pass (not 400)
      // This test verifies that the schema validation accepts email/password format
      // We expect either 401 (authentication failure) or 500 (service error), but NOT 400 (validation error)
      expect(response.statusCode).not.toBe(400);
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

    it('should reject login if both username and password are missing', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
