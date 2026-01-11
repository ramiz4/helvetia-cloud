import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock IORedis
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    setex: vi.fn(),
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
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      service: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      deployment: {
        findUnique: vi.fn(),
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { fastify } from './server';

// Get references to mocked modules after imports
let mockRedis: any;
let mockPrisma: any;

async function setup() {
  const IORedis = (await import('ioredis')).default;
  const { prisma } = await import('database');

  // Create instance to get the mock
  mockRedis = new IORedis();
  mockPrisma = prisma;
}

describe('Refresh Token Flow', () => {
  beforeEach(async () => {
    await setup();
    vi.clearAllMocks();
    await fastify.ready();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('JWT Configuration', () => {
    it('should configure JWT with 15 minute expiration', () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const decoded = fastify.jwt.decode(token) as any;
      const exp = decoded.exp;
      const iat = decoded.iat;

      // Should expire in approximately 15 minutes (900 seconds)
      expect(exp - iat).toBeGreaterThanOrEqual(899);
      expect(exp - iat).toBeLessThanOrEqual(901);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 401 when refresh token is not provided', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'Refresh token not provided',
      });
    });

    it('should return 401 when refresh token is revoked in Redis', async () => {
      const refreshToken = crypto.randomBytes(32).toString('hex');
      mockRedis.get.mockResolvedValue('1'); // Token is revoked

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mockRedis.get).toHaveBeenCalledWith(`revoked:refresh:${refreshToken}`);
    });

    it('should return 401 when refresh token is not found in database', async () => {
      const refreshToken = crypto.randomBytes(32).toString('hex');
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when refresh token is revoked in database', async () => {
      const refreshToken = crypto.randomBytes(32).toString('hex');
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: refreshToken,
        userId: 'user-1',
        revoked: true,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: {
          id: 'user-1',
          username: 'testuser',
          githubId: '123',
          avatarUrl: null,
          githubAccessToken: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when refresh token is expired', async () => {
      const refreshToken = crypto.randomBytes(32).toString('hex');
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: refreshToken,
        userId: 'user-1',
        revoked: false,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        createdAt: new Date(),
        user: {
          id: 'user-1',
          username: 'testuser',
          githubId: '123',
          avatarUrl: null,
          githubAccessToken: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('should successfully refresh tokens and rotate refresh token', async () => {
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const newRefreshToken = crypto.randomBytes(32).toString('hex');

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: refreshToken,
        userId: 'user-1',
        revoked: false,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000), // Valid for 1 day
        createdAt: new Date(),
        user: {
          id: 'user-1',
          username: 'testuser',
          githubId: '123',
          avatarUrl: null,
          githubAccessToken: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-2',
        token: newRefreshToken,
        userId: 'user-1',
        revoked: false,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000 * 30),
        createdAt: new Date(),
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('accessToken');
      expect(response.json()).toHaveProperty('message', 'Token refreshed successfully');

      // Old token should be revoked
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: refreshToken },
        data: expect.objectContaining({
          revoked: true,
        }),
      });

      // New refresh token should be created
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();

      // Should set cookies
      const setCookieHeaders = response.headers['set-cookie'];
      expect(setCookieHeaders).toBeDefined();
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully logout and clear cookies', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);
      const refreshToken = crypto.randomBytes(32).toString('hex');

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          cookie: `token=${token}; refreshToken=${refreshToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        message: 'Logged out successfully',
      });

      // Should clear cookies
      const setCookieHeaders = response.headers['set-cookie'];
      expect(setCookieHeaders).toBeDefined();
    });
  });

  describe('Token Rotation', () => {
    it('should invalidate old refresh token after rotation', async () => {
      const oldRefreshToken = crypto.randomBytes(32).toString('hex');
      const newRefreshToken = crypto.randomBytes(32).toString('hex');

      // First refresh - should succeed
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: oldRefreshToken,
        userId: 'user-1',
        revoked: false,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: {
          id: 'user-1',
          username: 'testuser',
          githubId: '123',
          avatarUrl: null,
          githubAccessToken: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-2',
        token: newRefreshToken,
        userId: 'user-1',
        revoked: false,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000 * 30),
        createdAt: new Date(),
      });

      const firstResponse = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: {
          refreshToken: oldRefreshToken,
        },
      });

      expect(firstResponse.statusCode).toBe(200);

      // Old token should now be revoked
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: oldRefreshToken },
        data: expect.objectContaining({
          revoked: true,
        }),
      });

      // Second attempt with old token - should fail
      vi.clearAllMocks();
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: oldRefreshToken,
        userId: 'user-1',
        revoked: true, // Now revoked
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        user: {
          id: 'user-1',
          username: 'testuser',
          githubId: '123',
          avatarUrl: null,
          githubAccessToken: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const secondResponse = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: {
          refreshToken: oldRefreshToken,
        },
      });

      expect(secondResponse.statusCode).toBe(401);
    });
  });

  describe('Access Token Expiration', () => {
    it('should reject requests with expired access tokens', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      // Create an already expired token
      const expiredToken = fastify.jwt.sign(mockUser, { expiresIn: '-1s' });

      mockPrisma.service.findMany.mockResolvedValue([]);

      const response = await fastify.inject({
        method: 'GET',
        url: '/services',
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept requests with valid short-lived access tokens', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      mockPrisma.service.findMany.mockResolvedValue([]);

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
});
