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

describe('SSE Token Expiration Handling', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure fastify is ready
    await fastify.ready();
  });

  describe('JWT Configuration', () => {
    it('should configure JWT with expiration', () => {
      expect(fastify.jwt).toBeDefined();
      expect(typeof fastify.jwt.sign).toBe('function');
      expect(typeof fastify.jwt.verify).toBe('function');
    });

    it('should create token with default 15 minute expiration', () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify the token includes the user data
      const decoded = fastify.jwt.decode(token) as any;
      expect(decoded.id).toBe('user-1');
      expect(decoded.username).toBe('testuser');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      // Should expire in approximately 15 minutes (900 seconds)
      const exp = decoded.exp;
      const iat = decoded.iat;
      expect(exp - iat).toBeGreaterThanOrEqual(899);
      expect(exp - iat).toBeLessThanOrEqual(901);
    });

    it('should create token with custom expiration', () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser, { expiresIn: '1h' });

      const decoded = fastify.jwt.decode(token) as any;
      const exp = decoded.exp;
      const iat = decoded.iat;

      // Should expire in approximately 1 hour (3600 seconds)
      expect(exp - iat).toBeGreaterThanOrEqual(3599);
      expect(exp - iat).toBeLessThanOrEqual(3601);
    });
  });

  describe('Authentication', () => {
    it('should reject requests with expired tokens', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      // Create an already expired token
      const expiredToken = fastify.jwt.sign(mockUser, { expiresIn: '-1s' });

      const response = await fastify.inject({
        method: 'GET',
        url: '/services',
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept requests with valid tokens', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      const response = await fastify.inject({
        method: 'GET',
        url: '/services',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('SSE Endpoint Protection', () => {
    it('should protect metrics stream endpoint with authentication', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/services/metrics/stream',
      });

      // Should be rejected without auth
      expect(response.statusCode).toBe(401);
    });

    it('should protect logs stream endpoint with authentication', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/deployments/test-deployment/logs/stream',
      });

      // Should be rejected without auth
      expect(response.statusCode).toBe(401);
    });

    it('should reject metrics stream with expired token', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const expiredToken = fastify.jwt.sign(mockUser, { expiresIn: '-1s' });

      const response = await fastify.inject({
        method: 'GET',
        url: '/services/metrics/stream',
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject logs stream with expired token', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const expiredToken = fastify.jwt.sign(mockUser, { expiresIn: '-1s' });

      const response = await fastify.inject({
        method: 'GET',
        url: '/deployments/test-deployment/logs/stream',
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Token Validation Logic', () => {
    it('should verify valid tokens successfully', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      // Simulate token verification
      const payload = fastify.jwt.verify(token);
      expect(payload).toMatchObject({
        id: 'user-1',
        username: 'testuser',
      });
    });

    it('should reject verification of expired tokens', () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const expiredToken = fastify.jwt.sign(mockUser, { expiresIn: '-1s' });

      // Should throw an error when verifying expired token
      expect(() => fastify.jwt.verify(expiredToken)).toThrow();
    });

    it('should reject verification of invalid tokens', () => {
      const invalidToken = 'invalid.token.here';

      // Should throw an error when verifying invalid token
      expect(() => fastify.jwt.verify(invalidToken)).toThrow();
    });
  });
});
