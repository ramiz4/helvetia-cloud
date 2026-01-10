import type { FastifyPluginAsync } from 'fastify';
import { GitHubController } from '../controllers/GitHubController';
import { resolve, TOKENS } from '../di';

/**
 * GitHub routes plugin
 * Handles GitHub API proxy endpoints
 */
export const githubRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<GitHubController>(TOKENS.GitHubController);

  /**
   * GET /github/orgs
   * Get user's GitHub organizations
   */
  fastify.get('/github/orgs', async (request, reply) => {
    return controller.getUserOrganizations(request, reply);
  });

  /**
   * GET /github/repos
   * Get user's or organization's repositories
   */
  fastify.get('/github/repos', async (request, reply) => {
    return controller.getRepositories(request, reply);
  });

  /**
   * GET /github/repos/:owner/:name/branches
   * Get branches for a specific repository
   */
  fastify.get('/github/repos/:owner/:name/branches', async (request, reply) => {
    return controller.getRepositoryBranches(request, reply);
  });
};
