import { describe, expect, it, vi } from 'vitest';

// We must mock BEFORE importing the server
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    subscribe: vi.fn(),
    removeListener: vi.fn(),
    quit: vi.fn(),
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
});
