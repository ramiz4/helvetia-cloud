import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const RedisMock = vi.fn(function () {
    return mockRedis;
  });
  return {
    default: RedisMock,
    Redis: RedisMock,
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
        add: vi.fn().mockResolvedValue({}),
      };
    }),
  };
});

vi.mock('database', () => {
  return {
    prisma: {
      service: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      deployment: {
        create: vi.fn(),
        deleteMany: vi.fn(),
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
    PrismaClient: vi.fn(),
    Role: {
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      DEVELOPER: 'DEVELOPER',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    },
    Prisma: {
      JsonNull: 'JsonNull',
    },
  };
});

vi.mock('dockerode', () => {
  return {
    default: class MockDocker {
      listContainers = vi.fn().mockResolvedValue([]);
      getContainer = vi.fn();
      listVolumes = vi.fn().mockResolvedValue({ Volumes: [] });
      getVolume = vi.fn();
    },
  };
});

vi.mock('@fastify/rate-limit', () => {
  return {
    default: vi.fn((instance, opts, done) => {
      done();
    }),
  };
});

import { buildServer } from './server.js';

describe('GitHub Webhook - Repo URL Normalization', () => {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';

  let mockPrisma: any;
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = webhookSecret;

    app = await buildServer();
    await app.ready();

    // Get the mocked prisma instance
    const { prisma } = await import('database');
    mockPrisma = prisma;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function generateSignature(payload: string): string {
    const hmac = crypto.createHmac('sha256', webhookSecret);
    return 'sha256=' + hmac.update(payload).digest('hex');
  }

  describe('Push Event', () => {
    it('should match service with exact URL (without .git)', async () => {
      const payload = {
        repository: {
          html_url: 'https://github.com/user/repo',
        },
        ref: 'refs/heads/main',
        after: 'abc123',
      };

      const mockService = {
        id: 'service-1',
        name: 'test-service',
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        userId: 'user-1',
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService]);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.deployment.create.mockResolvedValue({ id: 'deployment-1' });

      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(payloadString);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.servicesTriggered).toBe(1);

      // Verify findMany was called with OR condition
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { repoUrl: 'https://github.com/user/repo' },
            { repoUrl: 'https://github.com/user/repo.git' },
          ],
          branch: 'main',
          isPreview: false,
          deletedAt: null,
        },
      });
    });

    it('should match service with .git suffix in webhook URL', async () => {
      const payload = {
        repository: {
          html_url: 'https://github.com/user/repo.git',
        },
        ref: 'refs/heads/main',
        after: 'abc123',
      };

      const mockService = {
        id: 'service-1',
        name: 'test-service',
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        userId: 'user-1',
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService]);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.deployment.create.mockResolvedValue({ id: 'deployment-1' });

      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(payloadString);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      // Verify exact match with OR condition (normalized URL)
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { repoUrl: 'https://github.com/user/repo' },
            { repoUrl: 'https://github.com/user/repo.git' },
          ],
          branch: 'main',
          isPreview: false,
          deletedAt: null,
        },
      });
    });

    it('should handle URL with whitespace', async () => {
      const payload = {
        repository: {
          html_url: '  https://github.com/user/repo  ',
        },
        ref: 'refs/heads/main',
        after: 'abc123',
      };

      const mockService = {
        id: 'service-1',
        name: 'test-service',
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        userId: 'user-1',
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService]);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.deployment.create.mockResolvedValue({ id: 'deployment-1' });

      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(payloadString);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);

      // Verify trimming was applied
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { repoUrl: 'https://github.com/user/repo' },
            { repoUrl: 'https://github.com/user/repo.git' },
          ],
          branch: 'main',
          isPreview: false,
          deletedAt: null,
        },
      });
    });
  });

  describe('Pull Request Event - Opened', () => {
    it('should find base service with exact match', async () => {
      const payload = {
        action: 'opened',
        number: 123,
        pull_request: {
          base: {
            repo: {
              html_url: 'https://github.com/user/repo',
            },
          },
          head: {
            ref: 'feature-branch',
            sha: 'abc123',
          },
        },
      };

      const mockBaseService = {
        id: 'service-1',
        name: 'test-service',
        repoUrl: 'https://github.com/user/repo',
        branch: 'main',
        userId: 'user-1',
        buildCommand: 'npm run build',
        startCommand: 'npm start',
        port: 3000,
        type: 'DOCKER',
        staticOutputDir: 'dist',
        envVars: {},
      };

      const mockPreviewService = {
        id: 'service-2',
        name: 'test-service-pr-123',
        branch: 'feature-branch',
      };

      mockPrisma.service.findFirst
        .mockResolvedValueOnce(mockBaseService) // for findBaseServiceByRepoUrl
        .mockResolvedValueOnce(null); // for existingService (findByNameAndEnvironment)
      mockPrisma.service.create.mockResolvedValue(mockPreviewService);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.deployment.create.mockResolvedValue({ id: 'deployment-1' });

      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(payloadString);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.previewService).toBe('test-service-pr-123');

      // Verify findFirst was called with OR condition
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { repoUrl: 'https://github.com/user/repo' },
            { repoUrl: 'https://github.com/user/repo.git' },
          ],
          isPreview: false,
          deletedAt: null,
        },
      });
    });

    it('should handle .git suffix in PR webhook', async () => {
      const payload = {
        action: 'opened',
        number: 123,
        pull_request: {
          base: {
            repo: {
              html_url: 'https://github.com/user/repo.git',
            },
          },
          head: {
            ref: 'feature-branch',
            sha: 'abc123',
          },
        },
      };

      const mockBaseService = {
        id: 'service-1',
        name: 'test-service',
        repoUrl: 'https://github.com/user/repo.git',
        branch: 'main',
        userId: 'user-1',
        buildCommand: 'npm run build',
        startCommand: 'npm start',
        port: 3000,
        type: 'DOCKER',
        staticOutputDir: 'dist',
        envVars: {},
      };

      mockPrisma.service.findFirst
        .mockResolvedValueOnce(mockBaseService) // for findBaseServiceByRepoUrl
        .mockResolvedValueOnce(null); // for existingService (findByNameAndEnvironment)
      mockPrisma.service.create.mockResolvedValue({ id: 'service-2', name: 'test-service-pr-123' });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.deployment.create.mockResolvedValue({ id: 'deployment-1' });

      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(payloadString);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);

      // Verify normalized matching
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { repoUrl: 'https://github.com/user/repo' },
            { repoUrl: 'https://github.com/user/repo.git' },
          ],
          isPreview: false,
          deletedAt: null,
        },
      });
    });
  });

  describe('Pull Request Event - Closed', () => {
    it('should find preview service with exact match', async () => {
      const payload = {
        action: 'closed',
        number: 123,
        pull_request: {
          base: {
            repo: {
              html_url: 'https://github.com/user/repo',
            },
          },
          head: {
            ref: 'feature-branch',
          },
        },
      };

      const mockPreviewService = {
        id: 'service-2',
        name: 'test-service-pr-123',
        userId: 'user-1',
        type: 'DOCKER',
      };

      mockPrisma.service.findFirst.mockResolvedValue(mockPreviewService);
      mockPrisma.service.findUnique.mockResolvedValue(mockPreviewService);
      mockPrisma.service.delete.mockResolvedValue(mockPreviewService);
      mockPrisma.deployment.findMany.mockResolvedValue([]);
      mockPrisma.deployment.deleteMany.mockResolvedValue({ count: 2 });

      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(payloadString);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      // Verify findFirst was called with OR condition
      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where: {
          prNumber: 123,
          OR: [
            { repoUrl: 'https://github.com/user/repo' },
            { repoUrl: 'https://github.com/user/repo.git' },
          ],
          isPreview: true,
          deletedAt: null,
        },
      });
    });
  });
});
