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
  fastify.get(
    '/github/orgs',
    {
      schema: {
        tags: ['GitHub'],
        summary: 'Get GitHub organizations',
        description: 'Retrieve a list of GitHub organizations the authenticated user belongs to.',
        response: {
          200: {
            description: 'List of GitHub organizations',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  example: 12345678,
                },
                login: {
                  type: 'string',
                  example: 'my-org',
                },
                name: {
                  type: 'string',
                  example: 'My Organization',
                  nullable: true,
                },
                avatar_url: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://avatars.githubusercontent.com/u/12345678',
                },
                description: {
                  type: 'string',
                  example: 'Organization description',
                  nullable: true,
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - GitHub token missing or invalid',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getUserOrganizations(request, reply);
    },
  );

  /**
   * GET /github/repos
   * Get user's or organization's repositories
   */
  fastify.get(
    '/github/repos',
    {
      schema: {
        tags: ['GitHub'],
        summary: 'Get GitHub repositories',
        description: 'Retrieve repositories for the authenticated user or a specific organization.',
        querystring: {
          type: 'object',
          properties: {
            org: {
              type: 'string',
              description: 'Organization login (optional, defaults to user repos)',
              example: 'my-org',
            },
          },
        },
        response: {
          200: {
            description: 'List of GitHub repositories',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  example: 123456789,
                },
                name: {
                  type: 'string',
                  example: 'my-repo',
                },
                full_name: {
                  type: 'string',
                  example: 'user/my-repo',
                },
                description: {
                  type: 'string',
                  example: 'Repository description',
                  nullable: true,
                },
                private: {
                  type: 'boolean',
                  example: false,
                },
                html_url: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://github.com/user/my-repo',
                },
                clone_url: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://github.com/user/my-repo.git',
                },
                default_branch: {
                  type: 'string',
                  example: 'main',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getRepositories(request, reply);
    },
  );

  /**
   * GET /github/repos/:owner/:name/branches
   * Get branches for a specific repository
   */
  fastify.get(
    '/github/repos/:owner/:name/branches',
    {
      schema: {
        tags: ['GitHub'],
        summary: 'Get repository branches',
        description: 'Retrieve all branches for a specific GitHub repository.',
        params: {
          type: 'object',
          required: ['owner', 'name'],
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (username or organization)',
              example: 'user',
            },
            name: {
              type: 'string',
              description: 'Repository name',
              example: 'my-repo',
            },
          },
        },
        response: {
          200: {
            description: 'List of repository branches',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  example: 'main',
                },
                commit: {
                  type: 'object',
                  properties: {
                    sha: {
                      type: 'string',
                      example: 'abc123def456',
                    },
                    url: {
                      type: 'string',
                      format: 'uri',
                      example: 'https://api.github.com/repos/user/my-repo/commits/abc123',
                    },
                  },
                },
                protected: {
                  type: 'boolean',
                  example: true,
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Repository not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getRepositoryBranches(request, reply);
    },
  );

  /**
   * GET /github/packages
   * Get user's or organization's container images
   */
  fastify.get(
    '/github/packages',
    {
      schema: {
        tags: ['GitHub'],
        summary: 'Get GitHub container packages',
        description: 'Retrieve container images from GitHub Container Registry.',
        querystring: {
          type: 'object',
          properties: {
            org: {
              type: 'string',
              description: 'Organization login (optional)',
              example: 'my-org',
            },
          },
        },
        response: {
          200: {
            description: 'List of container packages',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  example: 123456,
                },
                name: {
                  type: 'string',
                  example: 'my-image',
                },
                package_type: {
                  type: 'string',
                  example: 'container',
                },
                visibility: {
                  type: 'string',
                  enum: ['public', 'private'],
                  example: 'private',
                },
                html_url: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://github.com/users/user/packages/container/my-image',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      return controller.getContainerImages(request, reply);
    },
  );
};
