import { beforeAll, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    subscribe: vi.fn(),
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

vi.mock('database', () => ({
  prisma: {
    service: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    deployment: {
      findMany: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const mockListContainers = vi.fn();
vi.mock('dockerode', () => {
  return {
    default: vi.fn(function () {
      return {
        listContainers: mockListContainers,
        getContainer: vi.fn(),
      };
    }),
  };
});

import { fastify } from './server';

describe('Service Status Determination', () => {
  beforeAll(async () => {
    await fastify.ready();
  });

  it('should return DEPLOYING when service status is explicitly DEPLOYING in DB', async () => {
    const { prisma } = await import('database');
    const mockUser = { id: 'user-1' };
    const mockService = {
      id: 'service-1',
      name: 'test-service',
      status: 'DEPLOYING',
      userId: 'user-1',
      type: 'DOCKER',
      deployments: [],
    };

    vi.mocked(prisma.service.findMany).mockResolvedValue([mockService] as never);
    mockListContainers.mockResolvedValue([
      {
        Id: 'container-1',
        State: 'running',
        Labels: { 'helvetia.serviceId': 'service-1' },
      },
    ]);

    const token = fastify.jwt.sign(mockUser);
    const response = await fastify.inject({
      method: 'GET',
      url: '/services',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const services = response.json();
    expect(services[0].status).toBe('DEPLOYING');
  });

  it('should return DEPLOYING when a deployment is QUEUED even if container is RUNNING', async () => {
    const { prisma } = await import('database');
    const mockUser = { id: 'user-1' };
    const mockService = {
      id: 'service-1',
      name: 'test-service',
      status: 'RUNNING',
      userId: 'user-1',
      type: 'DOCKER',
      deployments: [{ id: 'deploy-2', status: 'QUEUED', createdAt: new Date() }],
    };

    vi.mocked(prisma.service.findMany).mockResolvedValue([mockService] as never);
    vi.mocked(prisma.deployment.findMany).mockResolvedValue([
      { id: 'deploy-2', status: 'QUEUED', createdAt: new Date() },
    ] as never);
    mockListContainers.mockResolvedValue([
      {
        Id: 'container-1',
        State: 'running',
        Labels: { 'helvetia.serviceId': 'service-1' },
      },
    ]);

    const token = fastify.jwt.sign(mockUser);
    const response = await fastify.inject({
      method: 'GET',
      url: '/services',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const services = response.json();
    expect(services[0].status).toBe('DEPLOYING');
  });

  it('should return RUNNING when container is running and no active deployments', async () => {
    const { prisma } = await import('database');
    const mockUser = { id: 'user-1' };
    const mockService = {
      id: 'service-1',
      name: 'test-service',
      status: 'RUNNING',
      userId: 'user-1',
      type: 'DOCKER',
      deployments: [{ id: 'deploy-1', status: 'SUCCESS', createdAt: new Date() }],
    };

    vi.mocked(prisma.service.findMany).mockResolvedValue([mockService] as never);
    vi.mocked(prisma.deployment.findMany).mockResolvedValue([
      { id: 'deploy-1', status: 'SUCCESS', createdAt: new Date() },
    ] as never);
    mockListContainers.mockResolvedValue([
      {
        Id: 'container-1',
        State: 'running',
        Labels: { 'helvetia.serviceId': 'service-1' },
      },
    ]);

    const token = fastify.jwt.sign(mockUser);
    const response = await fastify.inject({
      method: 'GET',
      url: '/services',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const services = response.json();
    expect(services[0].status).toBe('RUNNING');
  });

  it('should return DEPLOYING for COMPOSE service when DB status is DEPLOYING', async () => {
    const { prisma } = await import('database');
    const mockUser = { id: 'user-1' };
    const mockService = {
      id: 'compose-1',
      name: 'my-stack',
      status: 'DEPLOYING',
      userId: 'user-1',
      type: 'COMPOSE',
      deployments: [],
    };

    vi.mocked(prisma.service.findMany).mockResolvedValue([mockService] as never);
    mockListContainers.mockResolvedValue([
      {
        Id: 'container-compose-1',
        State: 'running',
        Labels: { 'com.docker.compose.project': 'my-stack' },
      },
    ]);

    const token = fastify.jwt.sign(mockUser);
    const response = await fastify.inject({
      method: 'GET',
      url: '/services',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const services = response.json();
    expect(services[0].status).toBe('DEPLOYING');
  });
});
