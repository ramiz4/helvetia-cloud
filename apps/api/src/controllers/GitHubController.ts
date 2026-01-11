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
      console.log(`Fetched ${orgs.length} organizations for user ${user.id}`);
      return orgs;
    } catch (error: any) {
      console.error('GitHub Orgs API error:', error.data || error.message);
      return reply
        .status(error.status || 500)
        .send(error.data || { error: 'Failed to fetch GitHub organizations' });
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
        sort,
        type,
        per_page: per_page ? parseInt(per_page) : undefined,
        page: page ? parseInt(page) : undefined,
        org,
      });

      return repos;
    } catch (error: unknown) {
      const err = error as Error & { status?: number; data?: { message?: string } };
      console.error('GitHub Repos API error:', err.data || err.message);

      // Propagate GitHub API error with original status and message
      if (err.status && err.data) {
        const responseData = err.data.message ? { message: err.data.message } : err.data;
        return reply.status(err.status).send(responseData);
      }

      // Fallback to generic error
      return reply.status(500).send({ error: 'Failed to fetch GitHub repositories' });
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
    } catch (error: any) {
      // Handle validation errors from the service
      if (error.message?.includes('Invalid repository')) {
        return reply.status(400).send({ error: error.message });
      }

      console.error('GitHub API error:', error.data || error.message);

      // Propagate GitHub API error with original status and message
      if (error.status && error.data) {
        const responseData = error.data.message ? { message: error.data.message } : error.data;
        return reply.status(error.status).send(responseData);
      }

      // Fallback to generic error
      return reply.status(500).send({ error: 'Failed to fetch branches' });
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
