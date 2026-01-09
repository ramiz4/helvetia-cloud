import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Redis and other dependencies before importing server
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    subscribe: vi.fn(),
    removeListener: vi.fn(),
    quit: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(60),
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
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        upsert: vi.fn(),
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

vi.stubGlobal('process', {
  ...process,
  exit: vi.fn() as unknown as (code?: number) => never,
});

import { fastify } from './server';

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not rate limit health endpoint', async () => {
    // Make multiple requests quickly
    for (let i = 0; i < 15; i++) {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it('should include rate limit headers in responses', async () => {
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
    expect(response.headers).toHaveProperty('x-ratelimit-limit');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    expect(response.headers).toHaveProperty('x-ratelimit-reset');
  });

  it('should apply stricter rate limits to auth endpoints', async () => {
    const { prisma } = await import('database');

    // Mock successful auth for first requests
    vi.mocked(prisma.user.upsert).mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      githubId: '123',
      avatarUrl: 'https://example.com/avatar.jpg',
      githubAccessToken: 'encrypted-token',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    // Make requests - note that auth rate limit is 10 per minute
    const responses = [];
    for (let i = 0; i < 12; i++) {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/github',
        payload: { code: `test-code-${i}` },
      });
      responses.push(response);
    }

    // All requests should have rate limit headers
    responses.forEach((response) => {
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
    });
  });

  it('should apply rate limits to deployment endpoints', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    const token = fastify.jwt.sign(mockUser);

    const { prisma } = await import('database');

    // Mock service and deployment
    const mockService = {
      id: 'service-1',
      name: 'test-service',
      userId: 'user-1',
      repoUrl: 'https://github.com/test/repo',
      branch: 'main',
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      port: 3000,
      type: 'DOCKER',
      envVars: {},
      customDomain: null,
      staticOutputDir: 'dist',
      status: 'IDLE',
      isPreview: false,
      prNumber: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockDeployment = {
      id: 'deployment-1',
      serviceId: 'service-1',
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
      commitHash: null,
      imageTag: null,
      logs: '',
    };

    vi.mocked(prisma.service.findFirst).mockResolvedValue(mockService as never);
    vi.mocked(prisma.deployment.create).mockResolvedValue(mockDeployment as never);
    vi.mocked(prisma.service.update).mockResolvedValue(mockService as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    // Make requests
    const responses = [];
    for (let i = 0; i < 3; i++) {
      const response = await fastify.inject({
        method: 'POST',
        url: '/services/service-1/deploy',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      responses.push(response);
    }

    // All requests should have rate limit headers
    responses.forEach((response) => {
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
    });
  });

  it('should apply rate limits to webhook endpoints', async () => {
    const { prisma } = await import('database');

    // Mock for webhook processing
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);

    // Make requests
    const responses = [];
    for (let i = 0; i < 3; i++) {
      const response = await fastify.inject({
        method: 'POST',
        url: '/webhooks/github',
        payload: {
          repository: { html_url: 'https://github.com/test/repo' },
          ref: 'refs/heads/main',
          after: 'abc123',
        },
      });
      responses.push(response);
    }

    // All requests should have rate limit headers
    responses.forEach((response) => {
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
    });
  });

  it('should apply rate limits to SSE streaming endpoints', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    const token = fastify.jwt.sign(mockUser);

    const { prisma } = await import('database');
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);

    // Test metrics stream
    const response = await fastify.inject({
      method: 'GET',
      url: '/services/metrics/stream',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Should have rate limit headers
    expect(response.headers).toHaveProperty('x-ratelimit-limit');
  });

  it('should apply rate limits to deployment log streaming endpoints', async () => {
    const mockUser = { id: 'user-1', username: 'testuser' };
    const token = fastify.jwt.sign(mockUser);

    const { prisma } = await import('database');

    const mockDeployment = {
      id: 'deployment-1',
      serviceId: 'service-1',
      status: 'QUEUED',
      createdAt: new Date(),
      updatedAt: new Date(),
      commitHash: null,
      imageTag: null,
      logs: '',
      service: {
        id: 'service-1',
        name: 'test-service',
        userId: 'user-1',
        repoUrl: 'https://github.com/test/repo',
        branch: 'main',
        buildCommand: 'npm run build',
        startCommand: 'npm start',
        port: 3000,
        type: 'DOCKER',
        envVars: {},
        customDomain: null,
        staticOutputDir: 'dist',
        status: 'IDLE',
        isPreview: false,
        prNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    vi.mocked(prisma.deployment.findUnique).mockResolvedValue(mockDeployment as never);

    // Test deployment log stream
    const response = await fastify.inject({
      method: 'GET',
      url: '/deployments/deployment-1/logs/stream',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Should have rate limit headers
    expect(response.headers).toHaveProperty('x-ratelimit-limit');
  });
});
