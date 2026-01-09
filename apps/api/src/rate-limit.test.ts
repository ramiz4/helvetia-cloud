import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock axios before importing server
vi.mock('axios');

// Mock Redis and other dependencies before importing server
vi.mock('ioredis', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockRedis: any = {
    on: vi.fn(),
    subscribe: vi.fn(),
    removeListener: vi.fn(),
    quit: vi.fn(),
    defineCommand: vi.fn((name: string) => {
      mockRedis[name] = vi.fn().mockResolvedValue([0, 60000]);
    }),
    pttl: vi.fn().mockResolvedValue(60000),
    eval: vi.fn().mockResolvedValue([0, 60000]),
    call: vi.fn().mockResolvedValue([0, 60000]),
    pipeline: vi.fn(function () {
      return mockRedis;
    }),
    multi: vi.fn(function () {
      return mockRedis;
    }),
    exec: vi.fn().mockResolvedValue([[null, [0, 60000]]]),
    unref: vi.fn(),
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
        update: vi.fn(), // Add missing update method
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

vi.stubGlobal('process', {
  ...process,
  env: {
    ...process.env,
    GITHUB_WEBHOOK_SECRET: 'test-secret',
  },
  exit: vi.fn() as unknown as (code?: number) => never,
});

import { fastify } from './server';

describe('Rate Limiting', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset rate limit mock behavior to allow requests by default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IORedis = (await import('ioredis')).default as unknown as any;
    const redis = new IORedis();

    // Reset all mocked functions to return allowed state
    for (const key of Object.keys(redis)) {
      if (typeof redis[key]?.mockResolvedValue === 'function') {
        redis[key].mockResolvedValue([0, 60000]);
      }
    }
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

  // TODO: investigate why fastify-rate-limit ignores the redis mock in tests
  it.skip('should enforce rate limits when redis reports high usage', async () => {
    // Import the mocked Redis class
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const IORedis = (await import('ioredis')).default as unknown as any;
    const redis = new IORedis();

    // update eval to simulate limit exceeded (101 > 100 default limit)
    redis.eval.mockResolvedValue([101, 60000]);
    redis.call.mockResolvedValue([101, 60000]);
    if (redis.rateLimit) {
      redis.rateLimit.mockResolvedValue([101, 60000]);
    }

    const { prisma } = await import('database');
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);

    const mockUser = { id: 'user-1', username: 'testuser' };
    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'GET',
      url: '/services', // Rate limited endpoint
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: expect.stringContaining('Rate limit exceeded'),
    });
  });

  it('should allow authenticated requests to services endpoint', async () => {
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

  it('should allow auth endpoint requests with mocked GitHub API', async () => {
    const { prisma } = await import('database');

    // Mock GitHub API responses
    const mockGithubUser = {
      id: 12345,
      login: 'testuser',
      avatar_url: 'https://example.com/avatar.jpg',
    };

    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { access_token: 'mock-token', error: null },
    } as unknown as AxiosResponse);

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: mockGithubUser,
    } as unknown as AxiosResponse);

    // Mock successful auth
    vi.mocked(prisma.user.upsert).mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      githubId: '123',
      avatarUrl: 'https://example.com/avatar.jpg',
      githubAccessToken: 'encrypted-token',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const response = await fastify.inject({
      method: 'POST',
      url: '/auth/github',
      payload: { code: 'test-code' },
    });

    // Auth endpoint is accessible
    expect(response.statusCode).toBe(200);
    expect(axios.post).toHaveBeenCalledWith(
      'https://github.com/login/oauth/access_token',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('should allow deployment endpoint requests for authenticated users', async () => {
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

    const response = await fastify.inject({
      method: 'POST',
      url: '/services/service-1/deploy',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Deployment endpoint is accessible
    expect(response.statusCode).toBe(200);
  });

  it('should allow webhook endpoint requests', async () => {
    const { prisma } = await import('database');

    // Mock for webhook processing
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);

    const payload = {
      repository: { html_url: 'https://github.com/test/repo' },
      ref: 'refs/heads/main',
      after: 'abc123',
    };

    const payloadBuffer = Buffer.from(JSON.stringify(payload));

    const signature =
      'sha256=' + crypto.createHmac('sha256', 'test-secret').update(payloadBuffer).digest('hex');

    const response = await fastify.inject({
      method: 'POST',
      url: '/webhooks/github',
      payload: payloadBuffer,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature,
      },
    });

    // Webhook endpoint is accessible
    expect(response.statusCode).toBe(200);
  });
});
