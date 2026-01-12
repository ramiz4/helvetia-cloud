import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        updateMany: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        create: vi.fn(),
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
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
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
      url: '/api/v1/services',
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
    vi.mocked(prisma.deployment.findMany).mockResolvedValue([] as unknown as never);

    // Generate a mock token
    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/v1/services',
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
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null); // Check if name taken by another user - not found
    vi.mocked(prisma.service.findFirst).mockResolvedValueOnce(null); // findByNameAndUserId - not found
    vi.mocked(prisma.service.create).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/v1/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'new-service',
        environmentId: '123e4567-e89b-12d3-a456-426614174000',
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
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null); // Check if name taken - not found
    vi.mocked(prisma.service.findFirst).mockResolvedValueOnce(null); // findByNameAndUserId - not found
    vi.mocked(prisma.service.create).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/v1/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-postgres',
        environmentId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'POSTGRES',
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.name).toBe('my-postgres');

    // Verify create was called with correct port and credentials
    const createCall = vi.mocked(prisma.service.create).mock.calls[0][0];
    const envVars = createCall.data.envVars as Record<string, string>;
    expect(createCall.data.port).toBe(5444);
    expect(createCall.data.type).toBe('POSTGRES');
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
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.service.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.service.create).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/v1/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-redis',
        environmentId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'REDIS',
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.name).toBe('my-redis');

    // Verify create was called with correct port and credentials
    const createCall = vi.mocked(prisma.service.create).mock.calls[0][0];
    const envVars = createCall.data.envVars as Record<string, string>;
    expect(createCall.data.port).toBe(6379);
    expect(createCall.data.type).toBe('REDIS');
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
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.service.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.service.create).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/v1/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-mysql',
        environmentId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'MYSQL',
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.name).toBe('my-mysql');

    // Verify create was called with correct port and credentials
    const createCall = vi.mocked(prisma.service.create).mock.calls[0][0];
    const envVars = createCall.data.envVars as Record<string, string>;
    expect(createCall.data.port).toBe(3306);
    expect(createCall.data.type).toBe('MYSQL');
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
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.service.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.service.create).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const customPassword = 'my-custom-password';
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/v1/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-postgres-custom',
        environmentId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'POSTGRES',
        envVars: {
          POSTGRES_PASSWORD: customPassword,
          CUSTOM_VAR: 'custom-value',
        },
      },
    });

    expect(response.statusCode).toBe(200);

    // Verify user-provided password is preserved
    const createCall = vi.mocked(prisma.service.create).mock.calls[0][0];
    const envVars = createCall.data.envVars as Record<string, string>;
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
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.service.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.service.create).mockResolvedValue(mockService as unknown as never);

    const token = fastify.jwt.sign(mockUser);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/v1/services',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      payload: {
        name: 'my-static-site',
        environmentId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'STATIC',
        repoUrl: 'https://github.com/user/static-site',
      },
    });

    expect(response.statusCode).toBe(200);

    // Verify port is set to 80 for static sites
    const createCall = vi.mocked(prisma.service.create).mock.calls[0][0];
    expect(createCall.data.port).toBe(80);
    expect(createCall.data.type).toBe('STATIC');
  });
  it('should logout user and clear cookie', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
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
      url: '/api/v1/auth/logout',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Logged out successfully' });
  });

  describe('GitHub Webhook Signature Verification', () => {
    const originalEnv = process.env.GITHUB_WEBHOOK_SECRET;

    beforeEach(() => {
      // Set a test webhook secret
      process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret-key';
      vi.clearAllMocks();
    });

    afterEach(() => {
      // Restore original env
      if (originalEnv) {
        process.env.GITHUB_WEBHOOK_SECRET = originalEnv;
      } else {
        delete process.env.GITHUB_WEBHOOK_SECRET;
      }
    });

    function generateSignature(rawBody: string | Buffer, secret: string): string {
      const hmac = crypto.createHmac('sha256', secret);
      return 'sha256=' + hmac.update(rawBody).digest('hex');
    }

    it('should reject webhook request without signature', async () => {
      const payload = {
        repository: { html_url: 'https://github.com/test/repo' },
        ref: 'refs/heads/main',
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        payload,
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Missing signature' });
    });

    it('should reject webhook request with invalid signature', async () => {
      const payload = {
        repository: { html_url: 'https://github.com/test/repo' },
        ref: 'refs/heads/main',
      };

      const rawBody = Buffer.from(JSON.stringify(payload));

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': 'sha256=invalidsignature',
        },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Invalid signature' });
    });

    it('should accept webhook request with valid signature', async () => {
      const payload = {
        repository: { html_url: 'https://github.com/test/repo' },
        ref: 'refs/heads/main',
      };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = generateSignature(rawBody, 'test-webhook-secret-key');

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': signature,
        },
        payload: rawBody,
      });

      // Should not be 401 (might be 200 with skipped message or other valid response)
      expect(response.statusCode).not.toBe(401);
      expect(response.json()).toHaveProperty('skipped');
    });

    it('should handle pull request webhook with valid signature', async () => {
      const payload = {
        action: 'opened',
        number: 42,
        pull_request: {
          number: 42,
          head: {
            ref: 'feature-branch',
            sha: 'abc123',
          },
          base: {
            repo: {
              html_url: 'https://github.com/test/repo',
            },
          },
        },
      };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = generateSignature(rawBody, 'test-webhook-secret-key');

      const { prisma } = await import('database');
      vi.mocked(prisma.service.findFirst).mockResolvedValue(null);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': signature,
        },
        payload: rawBody,
      });

      expect(response.statusCode).not.toBe(401);
      expect(response.json()).toHaveProperty('skipped');
    });

    it('should return 500 if GITHUB_WEBHOOK_SECRET is not configured', async () => {
      delete process.env.GITHUB_WEBHOOK_SECRET;

      const payload = {
        repository: { html_url: 'https://github.com/test/repo' },
        ref: 'refs/heads/main',
      };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = generateSignature(rawBody, 'test-webhook-secret-key');

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': signature,
        },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: 'Webhook secret not configured' });
    });

    it('should log suspicious requests with missing signature', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const payload = {
        repository: { html_url: 'https://github.com/test/repo' },
        ref: 'refs/heads/main',
      };

      await fastify.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        payload,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'GitHub webhook received without signature',
        expect.objectContaining({
          ip: expect.any(String),
        }),
      );
    });

    it('should log suspicious requests with invalid signature', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      const payload = {
        repository: { html_url: 'https://github.com/test/repo' },
        ref: 'refs/heads/main',
      };

      const rawBody = Buffer.from(JSON.stringify(payload));

      await fastify.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': 'sha256=invalidsignature',
        },
        payload: rawBody,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'GitHub webhook signature verification failed',
        expect.objectContaining({
          ip: expect.any(String),
          signature: expect.stringContaining('sha256='),
        }),
      );
    });
  });
});
