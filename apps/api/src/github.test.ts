import axios from 'axios';
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
        getVolume: vi.fn(() => ({
          remove: vi.fn().mockResolvedValue({}),
        })),
      };
    }),
  };
});

vi.mock('axios');

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
      expect(response.json().error).toContain('GitHub account not linked');
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
  });

  describe('POST /webhooks/github', () => {
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

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhooks/github',
        payload: {
          action: 'opened',
          number: 123,
          pull_request: {
            number: 123,
            head: { ref: 'feature-branch', sha: 'abc1234' },
            base: { repo: { html_url: 'https://github.com/owner/repo' } },
          },
        },
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

      const response = await fastify.inject({
        method: 'POST',
        url: '/webhooks/github',
        payload: {
          action: 'closed',
          number: 123,
          pull_request: {
            number: 123,
            head: { ref: 'feature-branch' },
            base: { repo: { html_url: 'https://github.com/owner/repo' } },
          },
        },
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
