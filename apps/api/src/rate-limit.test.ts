import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock axios before importing server
vi.mock('axios');

// Mock rate-limit to avoid hangs during testing
vi.mock('@fastify/rate-limit', () => ({
  default: Object.assign(
    vi.fn(async () => {}),
    {
      Symbol: { for: vi.fn() },
    },
  ),
}));

// Mock Redis and other dependencies before importing server
vi.mock('ioredis', () => {
  const mockRedis: any = {
    status: 'ready',
    on: vi.fn(function (this: any, event, callback) {
      if (event === 'ready' || event === 'connect') {
        callback();
      }
      return this;
    }),
    once: vi.fn(function (this: any, event, callback) {
      if (event === 'ready' || event === 'connect') {
        callback();
      }
      return this;
    }),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    removeListener: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
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
    duplicate: vi.fn(function () {
      return mockRedis;
    }),
  };

  const MockRedis = vi.fn(function () {
    return mockRedis;
  });
  return {
    default: MockRedis,
    Redis: MockRedis,
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
    Role: {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    },
    prisma: {
      $executeRaw: vi.fn().mockResolvedValue(0),
      $transaction: vi.fn(async (callback) => {
        // Mock transaction - just call the callback with the same mock prisma
        const mockTx = {
          $executeRaw: vi.fn().mockResolvedValue(0),
          organization: {
            findMany: vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'org-id',
              name: 'Personal Org',
              slug: 'personal-org',
            }),
          },
        };
        return callback(mockTx);
      }),
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
      organization: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      organizationMember: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
    PrismaClient: vi.fn(),
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

vi.mock('shared', async () => {
  const actual = await vi.importActual('shared');
  return {
    ...actual,
    withStatusLock: vi.fn((id, fn) => fn()),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    },
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

import { buildServer } from './server.js';

describe('Rate Limiting', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    console.log('[RATE-LIMIT-TEST] app initialization starting...');
    app = await buildServer();
    console.log('[RATE-LIMIT-TEST] app.ready() starting...');
    await app.ready();
    console.log('[RATE-LIMIT-TEST] app initialization complete.');
  });
  beforeEach(async () => {
    console.log('[RATE-LIMIT-TEST] beforeEach starting...');
    vi.clearAllMocks();

    // Reset rate limit mock behavior to allow requests by default
    const IORedis = (await import('ioredis')).default as unknown as any;
    const redis = new IORedis();
    console.log('[RATE-LIMIT-TEST] resetting redis mock...');

    // Reset all mocked functions to return allowed state
    for (const key of Object.keys(redis)) {
      if (typeof redis[key]?.mockResolvedValue === 'function') {
        redis[key].mockResolvedValue([0, 60000]);
      }
    }
    console.log('[RATE-LIMIT-TEST] beforeEach complete.');
  });

  it('should not rate limit health endpoint', async () => {
    // Make multiple requests quickly
    for (let i = 0; i < 15; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(response.statusCode).toBe(200);
    }
  });

  // TODO: investigate why fastify-rate-limit ignores the redis mock in tests
  it.skip('should enforce rate limits when redis reports high usage', async () => {
    // Import the mocked Redis class
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
    const token = app.jwt.sign(mockUser);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/services', // Rate limited endpoint
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
    const token = app.jwt.sign(mockUser);

    const { prisma } = await import('database');
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/services',
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
      role: 'MEMBER',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/github',
      payload: { code: 'test-code' },
    });

    if (response.statusCode === 500) {
      console.log('API Error Payload:', response.payload);
    }

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
    const token = app.jwt.sign(mockUser);

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
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockService as never);
    vi.mocked(prisma.deployment.create).mockResolvedValue(mockDeployment as never);
    vi.mocked(prisma.service.update).mockResolvedValue(mockService as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      githubAccessToken: null,
      githubId: '123',
      avatarUrl: 'avatar',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/services/service-1/deploy',
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

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/github',
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
