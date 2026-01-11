/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyReply, FastifyRequest } from 'fastify';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GitHubBranch,
  GitHubOrganization,
  GitHubRepository,
  IGitHubService,
  IUserRepository,
} from '../interfaces';
import { GitHubController } from './GitHubController';

// Mock crypto module
vi.mock('../utils/crypto', () => ({
  decrypt: vi.fn((val) => val),
}));

describe('GitHubController', () => {
  let controller: GitHubController;
  let mockGitHubService: IGitHubService;
  let mockUserRepository: IUserRepository;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  const mockUser = {
    id: 'user-1',
    githubId: '12345',
    username: 'testuser',
    avatarUrl: 'https://avatar.com/user',
    createdAt: new Date(),
    updatedAt: new Date(),
    githubAccessToken: 'encrypted-token',
  };

  beforeEach(() => {
    // Mock GitHub service
    mockGitHubService = {
      getUserOrganizations: vi.fn(),
      getRepositories: vi.fn(),
      getRepositoryBranches: vi.fn(),
    };

    // Mock user repository
    mockUserRepository = {
      findById: vi.fn(),
      findByGithubId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    };

    // Create controller with mocked dependencies
    controller = new GitHubController(mockGitHubService, mockUserRepository);

    // Mock request and reply
    mockRequest = {
      user: { id: 'user-1', username: 'testuser' },
      query: {},
      params: {},
    } as any;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as any;
  });

  describe('getUserOrganizations', () => {
    it('should return organizations when user has valid token', async () => {
      const mockOrgs: GitHubOrganization[] = [
        {
          login: 'org1',
          id: 1,
          node_id: 'node1',
          url: 'https://api.github.com/orgs/org1',
          repos_url: 'https://api.github.com/orgs/org1/repos',
          events_url: 'https://api.github.com/orgs/org1/events',
          hooks_url: 'https://api.github.com/orgs/org1/hooks',
          issues_url: 'https://api.github.com/orgs/org1/issues',
          members_url: 'https://api.github.com/orgs/org1/members{/member}',
          public_members_url: 'https://api.github.com/orgs/org1/public_members{/member}',
          avatar_url: 'https://avatar.com/org1',
          description: 'Test Organization',
        },
      ];

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockGitHubService.getUserOrganizations).mockResolvedValue(mockOrgs);

      const result = await controller.getUserOrganizations(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
      expect(mockGitHubService.getUserOrganizations).toHaveBeenCalledWith('encrypted-token');
      expect(result).toEqual(mockOrgs);
    });

    it('should return 401 when user has no GitHub token', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue({
        ...mockUser,
        githubAccessToken: null,
      });

      await controller.getUserOrganizations(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error:
          'GitHub authentication required or token expired. Please reconnect your GitHub account.',
      });
    });

    it('should handle GitHub API errors', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockGitHubService.getUserOrganizations).mockRejectedValue({
        status: 403,
        data: { message: 'Rate limit exceeded' },
      });

      await controller.getUserOrganizations(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'Rate limit exceeded' });
    });
  });

  describe('getRepositories', () => {
    it('should return repositories with sanitized params', async () => {
      const mockRepos: GitHubRepository[] = [
        {
          id: 1,
          node_id: 'node1',
          name: 'repo1',
          full_name: 'user/repo1',
          private: false,
          owner: {
            login: 'user',
            id: 1,
            avatar_url: 'https://avatar.com/user',
          },
          html_url: 'https://github.com/user/repo1',
          description: 'Test repo',
          fork: false,
          url: 'https://api.github.com/repos/user/repo1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          pushed_at: '2024-01-01T00:00:00Z',
          git_url: 'git://github.com/user/repo1.git',
          ssh_url: 'git@github.com:user/repo1.git',
          clone_url: 'https://github.com/user/repo1.git',
          homepage: null,
          size: 100,
          stargazers_count: 10,
          watchers_count: 10,
          language: 'JavaScript',
          forks_count: 5,
          open_issues_count: 2,
          default_branch: 'main',
        },
      ];

      mockRequest.query = {
        sort: 'updated',
        per_page: '50',
        page: '1',
        type: 'all',
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockGitHubService.getRepositories).mockResolvedValue(mockRepos);

      const result = await controller.getRepositories(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockGitHubService.getRepositories).toHaveBeenCalledWith('encrypted-token', {
        sort: 'updated',
        type: 'all',
        per_page: 50,
        page: 1,
        org: undefined,
      });
      expect(result).toEqual(mockRepos);
    });

    it('should return 401 when user has no GitHub token', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue({
        ...mockUser,
        githubAccessToken: null,
      });

      await controller.getRepositories(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error:
          'GitHub authentication required or token expired. Please reconnect your GitHub account.',
      });
    });

    it('should handle GitHub API errors', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockGitHubService.getRepositories).mockRejectedValue({
        status: 500,
        data: { error: 'Internal error' },
      });

      await controller.getRepositories(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Internal error' });
    });
  });

  describe('getRepositoryBranches', () => {
    it('should return branches for valid repository', async () => {
      const mockBranches: GitHubBranch[] = [
        {
          name: 'main',
          commit: { sha: 'abc123', url: 'https://api.github.com/repos/owner/repo/commits/abc123' },
          protected: false,
        },
        {
          name: 'develop',
          commit: { sha: 'def456', url: 'https://api.github.com/repos/owner/repo/commits/def456' },
          protected: false,
        },
      ];

      mockRequest.params = { owner: 'owner', name: 'repo' };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockGitHubService.getRepositoryBranches).mockResolvedValue(mockBranches);

      const result = await controller.getRepositoryBranches(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockGitHubService.getRepositoryBranches).toHaveBeenCalledWith(
        'encrypted-token',
        'owner',
        'repo',
      );
      expect(result).toEqual(mockBranches);
    });

    it('should return 400 for invalid owner or name format', async () => {
      mockRequest.params = { owner: 'owner;rm -rf', name: 'repo' };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockGitHubService.getRepositoryBranches).mockRejectedValue(
        new Error('Invalid repository owner or name format'),
      );

      await controller.getRepositoryBranches(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid repository owner or name format',
      });
    });

    it('should return 401 when user has no GitHub token', async () => {
      mockRequest.params = { owner: 'owner', name: 'repo' };

      vi.mocked(mockUserRepository.findById).mockResolvedValue({
        ...mockUser,
        githubAccessToken: null,
      });

      await controller.getRepositoryBranches(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error:
          'GitHub authentication required or token expired. Please reconnect your GitHub account.',
      });
    });

    it('should handle GitHub API errors', async () => {
      mockRequest.params = { owner: 'owner', name: 'repo' };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockGitHubService.getRepositoryBranches).mockRejectedValue({
        status: 404,
        data: { message: 'Not Found' },
      });

      await controller.getRepositoryBranches(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ message: 'Not Found' });
    });
  });
});
