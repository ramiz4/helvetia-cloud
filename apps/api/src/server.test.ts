import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// Mock process.exit
vi.stubGlobal('process', {
  ...process,
  exit: vi.fn() as unknown as (code?: number) => never,
});

vi.mock('@fastify/rate-limit', () => {
  return {
    default: vi.fn((instance, opts, done) => {
      done();
    }),
  };
});

import { fastify } from './server';

describe('API Server', () => {
  beforeEach(() => {
    // Clear all mocks before each test to ensure clean state
    vi.clearAllMocks();
  });

  it('should have a health check endpoint', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('should require authentication for protected routes', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/services',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return services for an authorized user', async () => {
    // Mock user and services
    const mockUser = { id: 'user-1', username: 'testuser' };
    const mockServices = [
      { id: 'service-1', name: 'test-service', userId: 'user-1', deployments: [] },
    ];

    // Mock Prisma
    const { prisma } = await import('database');
    vi.mocked(prisma.service.findMany).mockResolvedValue(mockServices as unknown as never);

    // Generate a mock token
    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'GET',
      url: '/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json).toBeInstanceOf(Array);
    expect(json[0].name).toBe('test-service');
  });

  it('should create a new service', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    const mockService = {
      id: 'service-2',
      name: 'new-service',
      userId: 'user-1',
    };

    const { prisma } = await import('database');
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null); // Not taken
    vi.mocked(prisma.service.upsert).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'new-service',
        repoUrl: 'https://github.com/user/new-repo',
        type: 'DOCKER',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('new-service');
  });

  it('should create a PostgreSQL service with default port and auto-generated credentials', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    const mockService = {
      id: 'service-postgres',
      name: 'my-postgres',
      userId: 'user-1',
      type: 'POSTGRES',
      port: 5444,
    };

    const { prisma } = await import('database');
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.service.upsert).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-postgres',
        type: 'POSTGRES',
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.name).toBe('my-postgres');

    // Verify upsert was called with correct port and credentials
    const upsertCall = vi.mocked(prisma.service.upsert).mock.calls[0][0];
    const envVars = upsertCall.create.envVars as Record<string, string>;
    expect(upsertCall.create.port).toBe(5444);
    expect(upsertCall.create.type).toBe('POSTGRES');
    expect(envVars).toHaveProperty('POSTGRES_USER', 'postgres');
    expect(envVars).toHaveProperty('POSTGRES_PASSWORD');
    expect(envVars).toHaveProperty('POSTGRES_DB', 'app');
    // Verify password is a hex string (32 chars for 16 bytes)
    expect(envVars.POSTGRES_PASSWORD).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should create a Redis service with default port and auto-generated password', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    const mockService = {
      id: 'service-redis',
      name: 'my-redis',
      userId: 'user-1',
      type: 'REDIS',
      port: 6379,
    };

    const { prisma } = await import('database');
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.service.upsert).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-redis',
        type: 'REDIS',
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.name).toBe('my-redis');

    // Verify upsert was called with correct port and credentials
    const upsertCall = vi.mocked(prisma.service.upsert).mock.calls[0][0];
    const envVars = upsertCall.create.envVars as Record<string, string>;
    expect(upsertCall.create.port).toBe(6379);
    expect(upsertCall.create.type).toBe('REDIS');
    expect(envVars).toHaveProperty('REDIS_PASSWORD');
    // Verify password is a hex string (32 chars for 16 bytes)
    expect(envVars.REDIS_PASSWORD).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should create a MySQL service with default port and auto-generated credentials', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    const mockService = {
      id: 'service-mysql',
      name: 'my-mysql',
      userId: 'user-1',
      type: 'MYSQL',
      port: 3306,
    };

    const { prisma } = await import('database');
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.service.upsert).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-mysql',
        type: 'MYSQL',
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.name).toBe('my-mysql');

    // Verify upsert was called with correct port and credentials
    const upsertCall = vi.mocked(prisma.service.upsert).mock.calls[0][0];
    const envVars = upsertCall.create.envVars as Record<string, string>;
    expect(upsertCall.create.port).toBe(3306);
    expect(upsertCall.create.type).toBe('MYSQL');
    expect(envVars).toHaveProperty('MYSQL_ROOT_PASSWORD');
    expect(envVars).toHaveProperty('MYSQL_DATABASE', 'app');
    // Verify password is a hex string (32 chars for 16 bytes)
    expect(envVars.MYSQL_ROOT_PASSWORD).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should not override user-provided credentials for PostgreSQL', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    const mockService = {
      id: 'service-postgres-custom',
      name: 'my-postgres-custom',
      userId: 'user-1',
      type: 'POSTGRES',
      port: 5444,
    };

    const { prisma } = await import('database');
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.service.upsert).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const customPassword = 'my-custom-password';
    const response = await fastify.inject({
      method: 'POST',
      url: '/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-postgres-custom',
        type: 'POSTGRES',
        envVars: {
          POSTGRES_PASSWORD: customPassword,
          CUSTOM_VAR: 'custom-value',
        },
      },
    });

    expect(response.statusCode).toBe(200);

    // Verify user-provided password is preserved
    const upsertCall = vi.mocked(prisma.service.upsert).mock.calls[0][0];
    const envVars = upsertCall.create.envVars as Record<string, string>;
    expect(envVars.POSTGRES_PASSWORD).toBe(customPassword);
    expect(envVars.CUSTOM_VAR).toBe('custom-value');
  });

  it('should create a STATIC service with port 80', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    const mockService = {
      id: 'service-static',
      name: 'my-static-site',
      userId: 'user-1',
      type: 'STATIC',
      port: 80,
    };

    const { prisma } = await import('database');
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.service.upsert).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-static-site',
        type: 'STATIC',
        repoUrl: 'https://github.com/user/static-site',
      },
    });

    expect(response.statusCode).toBe(200);

    // Verify port is set to 80 for static sites
    const upsertCall = vi.mocked(prisma.service.upsert).mock.calls[0][0];
    expect(upsertCall.create.port).toBe(80);
    expect(upsertCall.create.type).toBe('STATIC');
  });
  it('should logout user and clear cookie', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/logout',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Logged out successfully' });

    // Check set-cookie header
    // fastify-cookie sets headers as an array of strings in the response object for inject
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();

    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie as string);

    // Verify cookie clearing attributes
    expect(cookieStr).toContain('token=;');
    expect(cookieStr).toContain('Max-Age=0');
    expect(cookieStr).toContain('Path=/');
    expect(cookieStr).toContain('HttpOnly');
    expect(cookieStr).toContain('SameSite=Lax');
  });

  it('should allow logout without authentication', async () => {
    // Even without a token, logout should succeed (idempotent/safe)
    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/logout',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Logged out successfully' });
  });
});
