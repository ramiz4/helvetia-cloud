import axios from 'axios';
import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// We use vi.hoisted to ensure these mocks are available during hoisting
const { mockQueueInstance } = vi.hoisted(() => ({
  mockQueueInstance: {
    add: vi.fn(),
  },
}));

// Mock dependencies
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
      return mockQueueInstance;
    }),
  };
});

vi.mock('database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    service: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    deployment: {
      create: vi.fn(),
      findMany: vi.fn(),
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
}));

vi.mock('dockerode', () => {
  return {
    default: vi.fn(function () {
      return {
        listContainers: vi.fn().mockResolvedValue([]),
        getContainer: vi.fn(() => ({
          stop: vi.fn().mockResolvedValue({}),
          remove: vi.fn().mockResolvedValue({}),
          inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
        })),
        getImage: vi.fn(() => ({
          remove: vi.fn().mockResolvedValue({}),
        })),
        getVolume: vi.fn(() => ({
          remove: vi.fn().mockResolvedValue({}),
        })),
        listVolumes: vi.fn().mockResolvedValue({ Volumes: [] }),
      };
    }),
  };
});

vi.mock('axios');
vi.mock('./utils/crypto', () => ({
  encrypt: vi.fn((val) => val),
  decrypt: vi.fn((val) => val),
}));

import { fastify } from './server';

describe('GitHub Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/github', () => {
    it('should exchange code for token and upsert user with githubAccessToken', async () => {
      const mockCode = 'github-code';
      const mockAccessToken = 'gh_access_token';
      const mockGithubUser = {
        id: 12345,
        login: 'testuser',
        avatar_url: 'https://avatar.com/u/12345',
      };
      const mockDbUser = {
        id: 'user-uuid',
        githubId: '12345',
        username: 'testuser',
        avatarUrl: 'https://avatar.com/u/12345',
        githubAccessToken: mockAccessToken,
      };

      // Mock GitHub API responses
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { access_token: mockAccessToken },
      });
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockGithubUser,
      });

      // Mock Prisma upsert
      const { prisma } = await import('database');
      vi.mocked(prisma.user.upsert).mockResolvedValue(mockDbUser as never);

      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/github',
        payload: { code: mockCode },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.user.githubAccessToken).toBe(mockAccessToken);

      // Verify Prisma call
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { githubId: '12345' },
        update: expect.objectContaining({ githubAccessToken: mockAccessToken }),
        create: expect.objectContaining({ githubAccessToken: mockAccessToken }),
      });
    });
  });

  describe('GET /github/repos', () => {
    it('should fetch repos using the stored githubAccessToken', async () => {
      const mockUser = { id: 'user-uuid', username: 'testuser' };
      const mockAccessToken = 'gh_access_token';
      const mockRepos = [{ name: 'repo1' }, { name: 'repo2' }];

      // Mock Prisma to return user with token
      const { prisma } = await import('database');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        githubAccessToken: mockAccessToken,
      } as never);

      // Mock GitHub API
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockRepos,
      });

      const token = fastify.jwt.sign(mockUser);

      const response = await fastify.inject({
        method: 'GET',
        url: '/github/repos',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockRepos);

      // Verify axios call with correct header
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/user/repos',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `token ${mockAccessToken}`,
          }),
        }),
      );
    });

    it('should validate query parameters and use defaults for invalid values', async () => {
      const mockUser = { id: 'user-uuid', username: 'testuser' };
      const mockAccessToken = 'gh_access_token';

      const { prisma } = await import('database');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        githubAccessToken: mockAccessToken,
      } as never);

      vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });

      const token = fastify.jwt.sign(mockUser);

      await fastify.inject({
        method: 'GET',
        url: '/github/repos?sort=invalid&per_page=999&page=-5',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/user/repos',
        expect.objectContaining({
          params: {
            sort: 'updated', // default for invalid
            per_page: 100, // capped at 100
            type: 'all',
            page: 1, // min 1
          },
        }),
      );
    });

    it('should handle GitHub API errors gracefully', async () => {
      const mockUser = { id: 'user-uuid', username: 'testuser' };
      const { prisma } = await import('database');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        githubAccessToken: 'token',
      } as never);

      vi.mocked(axios.get).mockRejectedValueOnce({
        response: {
          status: 403,
          data: { message: 'Rate limit exceeded' },
        },
      });

      const token = fastify.jwt.sign(mockUser);
      const response = await fastify.inject({
        method: 'GET',
        url: '/github/repos',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ message: 'Rate limit exceeded' });
    });

    it('should return 401 if user has no githubAccessToken', async () => {
      const mockUser = { id: 'user-uuid', username: 'testuser' };

      const { prisma } = await import('database');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        githubAccessToken: null,
      } as never);

      const token = fastify.jwt.sign(mockUser);

      const response = await fastify.inject({
        method: 'GET',
        url: '/github/repos',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toContain('GitHub authentication required');
    });
  });

  describe('GET /github/repos/:owner/:name/branches', () => {
    it('should fetch branches using stored githubAccessToken', async () => {
      const mockUser = { id: 'user-uuid', username: 'testuser' };
      const mockAccessToken = 'gh_access_token';
      const mockBranches = [{ name: 'main' }, { name: 'develop' }];

      const { prisma } = await import('database');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        githubAccessToken: mockAccessToken,
      } as never);

      vi.mocked(axios.get).mockResolvedValueOnce({
        data: mockBranches,
      });

      const token = fastify.jwt.sign(mockUser);

      const response = await fastify.inject({
        method: 'GET',
        url: '/github/repos/owner/repo/branches',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockBranches);
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/branches',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `token ${mockAccessToken}`,
          }),
        }),
      );
    });

    it('should return 400 for invalid owner or name characters', async () => {
      const mockUser = { id: 'user-uuid', username: 'testuser' };
      const token = fastify.jwt.sign(mockUser);

      const response = await fastify.inject({
        method: 'GET',
        url: '/github/repos/owner;rm -rf/repo/branches',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain('Invalid repository owner or name format');
    });

    it('should propagate GitHub API errors for branches', async () => {
      const mockUser = { id: 'user-uuid', username: 'testuser' };
      const { prisma } = await import('database');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        githubAccessToken: 'token',
      } as never);

      vi.mocked(axios.get).mockRejectedValueOnce({
        response: {
          status: 404,
          data: { message: 'Not Found' },
        },
      });

      const token = fastify.jwt.sign(mockUser);
      const response = await fastify.inject({
        method: 'GET',
        url: '/github/repos/owner/repo/branches',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ message: 'Not Found' });
    });
  });

  describe('POST /webhooks/github', () => {
    // Set webhook secret for these tests
    beforeEach(() => {
      process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
    });

    function generateSignature(rawBody: string | Buffer, secret: string): string {
      const hmac = crypto.createHmac('sha256', secret);
      return 'sha256=' + hmac.update(rawBody).digest('hex');
    }

    it('should create a preview environment and inject token into queue', async () => {
      const { prisma } = await import('database');
      const mockBaseService = {
        id: 'base-service-id',
        name: 'base-service',
        repoUrl: 'https://github.com/owner/repo',
        isPreview: false,
        userId: 'user-uuid',
        buildCommand: 'npm run build',
        startCommand: 'npm start',
        port: 3000,
        type: 'DOCKER',
        envVars: { KEY: 'VALUE' },
      };

      vi.mocked(prisma.service.findFirst).mockResolvedValue(mockBaseService as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-uuid',
        githubAccessToken: 'mock-token',
      } as never);
      vi.mocked(prisma.service.upsert).mockResolvedValue({
        id: 'preview-service-id',
        name: 'base-service-pr-123',
        repoUrl: mockBaseService.repoUrl,
        userId: 'user-uuid',
      } as never);
      vi.mocked(prisma.deployment.create).mockResolvedValue({ id: 'deployment-id' } as never);

      const payload = {
        action: 'opened',
        number: 123,
        pull_request: {
          number: 123,
          head: { ref: 'feature-branch', sha: 'abc1234' },
          base: { repo: { html_url: 'https://github.com/owner/repo' } },
        },
      };

      const rawBody = Buffer.from(JSON.stringify(payload));
      const response = await fastify.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': generateSignature(rawBody, 'test-webhook-secret'),
        },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);

      // Verify token injection in repoUrl passed to queue
      expect(mockQueueInstance.add).toHaveBeenCalledWith(
        'build',
        expect.objectContaining({
          repoUrl: 'https://mock-token@github.com/owner/repo',
        }),
      );
    });

    it('should delete the preview environment when a PR is closed', async () => {
      const { prisma } = await import('database');
      const mockPreviewService = {
        id: 'preview-service-id',
        name: 'base-service-pr-123',
        userId: 'user-uuid',
      };

      vi.mocked(prisma.service.findFirst).mockResolvedValue(mockPreviewService as never);
      vi.mocked(prisma.service.findUnique).mockResolvedValue(mockPreviewService as never);
      vi.mocked(prisma.service.delete).mockResolvedValue(mockPreviewService as never);
      vi.mocked(prisma.deployment.findMany).mockResolvedValue([]);

      const payload = {
        action: 'closed',
        number: 123,
        pull_request: {
          number: 123,
          head: { ref: 'feature-branch' },
          base: { repo: { html_url: 'https://github.com/owner/repo' } },
        },
      };

      const rawBody = Buffer.from(JSON.stringify(payload));
      const response = await fastify.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': generateSignature(rawBody, 'test-webhook-secret'),
        },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        deletedService: 'base-service-pr-123',
      });

      // Verify deletion from DB
      expect(prisma.service.delete).toHaveBeenCalledWith({
        where: { id: 'preview-service-id' },
      });
    });
  });
});
