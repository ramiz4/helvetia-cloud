import '../types/fastify';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import type { IGitHubService, IUserRepository } from '../interfaces';
import { decrypt } from '../utils/crypto';

/**
 * GitHubController
 * Handles GitHub API proxy endpoints
 * Thin controller layer that delegates to GitHubService
 */
interface GitHubApiError {
  status?: number;
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
  data?: {
    message?: string;
    error?: string;
  };
}

@injectable()
export class GitHubController {
  constructor(
    @inject(Symbol.for('IGitHubService'))
    private githubService: IGitHubService,
    @inject(Symbol.for('IUserRepository'))
    private userRepository: IUserRepository,
  ) {}

  /**
   * GET /github/orgs
   * Get user's GitHub organizations
   */
  async getUserOrganizations(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const accessToken = await this.getDecryptedGitHubToken(user.id);

      if (!accessToken) {
        return reply.status(401).send({
          error:
            'GitHub authentication required or token expired. Please reconnect your GitHub account.',
        });
      }

      const orgs = await this.githubService.getUserOrganizations(accessToken);
      request.log.info(
        { userId: user.id, orgCount: orgs.length },
        'Fetched organizations from GitHub',
      );
      return orgs;
    } catch (error: unknown) {
      const err = error as GitHubApiError;
      const status = err.status || err.response?.status || 500;
      const data = err.data || err.response?.data || {};
      const message = err.message || 'Failed to fetch GitHub organizations';

      request.log.error({ err: error, userId: user.id }, 'GitHub Orgs API error');

      if (status !== 500) {
        return reply.status(status).send(data);
      }

      return reply.status(500).send({ error: message });
    }
  }

  /**
   * GET /github/repos
   * Get user's or organization's repositories
   */
  async getRepositories(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }
    const { sort, per_page, type, page, org } = request.query as {
      sort?: string;
      per_page?: string;
      type?: string;
      page?: string;
      org?: string;
    };

    try {
      const accessToken = await this.getDecryptedGitHubToken(user.id);

      if (!accessToken) {
        return reply.status(401).send({
          error:
            'GitHub authentication required or token expired. Please reconnect your GitHub account.',
        });
      }

      const repos = await this.githubService.getRepositories(accessToken, {
        sort: sort as 'created' | 'updated' | 'pushed' | 'full_name',
        type: type as 'all' | 'owner' | 'public' | 'private' | 'member',
        per_page: per_page ? parseInt(per_page) : undefined,
        page: page ? parseInt(page) : undefined,
        org,
      });

      return repos;
    } catch (error: unknown) {
      const err = error as GitHubApiError;
      const status = err.status || err.response?.status || 500;
      const data = err.data || err.response?.data || {};
      const message = err.message || 'Failed to fetch GitHub repositories';

      request.log.error({ err: error, userId: user.id, org }, 'GitHub Repos API error');

      if (status !== 500) {
        return reply.status(status).send(data);
      }

      return reply.status(500).send({ error: message });
    }
  }

  /**
   * GET /github/repos/:owner/:name/branches
   * Get branches for a specific repository
   */
  async getRepositoryBranches(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }
    const { owner, name } = request.params as { owner: string; name: string };

    try {
      const accessToken = await this.getDecryptedGitHubToken(user.id);

      if (!accessToken) {
        return reply.status(401).send({
          error:
            'GitHub authentication required or token expired. Please reconnect your GitHub account.',
        });
      }

      const branches = await this.githubService.getRepositoryBranches(accessToken, owner, name);
      return branches;
    } catch (error: unknown) {
      const err = error as GitHubApiError;
      const status = err.status || err.response?.status || 500;
      const data = err.data || err.response?.data || {};
      const message = err.message || 'Failed to fetch branches';

      // Handle validation errors from the service
      if (message?.includes('Invalid repository')) {
        return reply.status(400).send({ error: message });
      }

      request.log.error({ err: error, userId: user.id, owner, name }, 'GitHub API error');

      if (status !== 500) {
        return reply.status(status).send(data);
      }

      return reply.status(500).send({ error: message });
    }
  }

  /**
   * GET /github/packages
   * Get user's or organization's container images
   */
  async getContainerImages(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }
    const { org } = request.query as { org?: string };

    try {
      const accessToken = await this.getDecryptedGitHubToken(user.id);

      if (!accessToken) {
        return reply.status(401).send({
          error:
            'GitHub authentication required or token expired. Please reconnect your GitHub account.',
        });
      }

      const packages = await this.githubService.getContainerImages(accessToken, org);
      return packages;
    } catch (error: unknown) {
      const err = error as GitHubApiError;
      const status = err.status || err.response?.status || 500;
      const data = err.data || err.response?.data || {};
      const message = err.message || 'Failed to fetch container images';

      request.log.error({ err: error, userId: user.id, org }, 'GitHub Packages API error');

      if (status !== 500) {
        return reply.status(status).send(data);
      }

      return reply.status(500).send({ error: message });
    }
  }

  /**
   * Helper to get and decrypt GitHub access token for a user
   */
  private async getDecryptedGitHubToken(userId: string): Promise<string | null> {
    const dbUser = await this.userRepository.findById(userId);

    if (!dbUser?.githubAccessToken) {
      return null;
    }

    return decrypt(dbUser.githubAccessToken);
  }
}
