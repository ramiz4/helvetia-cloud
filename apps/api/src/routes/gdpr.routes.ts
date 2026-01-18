import type { FastifyPluginAsync } from 'fastify';
import { BODY_LIMIT_SMALL } from '../config/constants';
import { resolve, TOKENS } from '../di';
import type { IOrganizationRepository, IProjectRepository, IUserRepository } from '../interfaces';
import { authenticate } from '../middleware/auth.middleware';

/**
 * GDPR/Data Privacy routes plugin
 * Handles GDPR-compliant data export and deletion requests
 */
export const gdprRoutes: FastifyPluginAsync = async (fastify) => {
  const userRepository = resolve<IUserRepository>(TOKENS.UserRepository);
  const projectRepository = resolve<IProjectRepository>(TOKENS.ProjectRepository);
  const organizationRepository = resolve<IOrganizationRepository>(TOKENS.OrganizationRepository);
  const redisConnection = fastify.redis;
  const { createRateLimitConfigs } = await import('../config/rateLimit.js');
  const { defaultRateLimitConfig } = createRateLimitConfigs(redisConnection);

  /**
   * GET /gdpr/export
   * Export all user data in JSON format (GDPR Article 20 - Right to data portability)
   */
  fastify.get(
    '/gdpr/export',
    {
      preHandler: [authenticate],
      config: { rateLimit: defaultRateLimitConfig },
      schema: {
        tags: ['GDPR'],
        summary: 'Export user data',
        description:
          'Export all personal data associated with the authenticated user in a structured, machine-readable format (GDPR Article 20 - Right to data portability)',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'User data export',
            type: 'object',
            properties: {
              user: {
                type: 'object',
                description: 'User account information',
              },
              projects: {
                type: 'array',
                description: 'All projects owned by the user',
              },
              organizations: {
                type: 'array',
                description: 'Organizations the user is a member of',
              },
              exportDate: {
                type: 'string',
                format: 'date-time',
                description: 'Timestamp of data export',
              },
            },
          },
          401: {
            description: 'Unauthorized - Invalid or missing token',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            description: 'User not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;

        // Fetch all user data
        const user = await userRepository.findById(userId);
        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        // Fetch all projects
        const projects = await projectRepository.findByUserId(userId);

        // Fetch organizations
        const organizations = await organizationRepository.findByUserId(userId);

        // Remove sensitive data (encrypted tokens, etc.)
        const sanitizedUser = {
          id: user.id,
          username: user.username,
          githubId: user.githubId,
          avatarUrl: user.avatarUrl,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };

        const exportData = {
          user: sanitizedUser,
          projects,
          organizations,
          exportDate: new Date().toISOString(),
          dataTypes: [
            'Account information',
            'GitHub profile data',
            'Projects and deployments',
            'Organization memberships',
          ],
        };

        fastify.log.info({ userId }, 'User data exported');

        return reply.status(200).send(exportData);
      } catch (error) {
        fastify.log.error({ error }, 'Error exporting user data');
        return reply.status(500).send({ error: 'Failed to export user data' });
      }
    },
  );

  /**
   * DELETE /gdpr/delete-account
   * Permanently delete user account and all associated data (GDPR Article 17 - Right to erasure)
   */
  fastify.delete(
    '/gdpr/delete-account',
    {
      preHandler: [authenticate],
      config: { rateLimit: defaultRateLimitConfig },
      bodyLimit: BODY_LIMIT_SMALL,
      schema: {
        tags: ['GDPR'],
        summary: 'Delete user account',
        description:
          'Permanently delete the authenticated user account and all associated data (GDPR Article 17 - Right to erasure / Right to be forgotten). This action cannot be undone.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['confirmUsername'],
          properties: {
            confirmUsername: {
              type: 'string',
              description: 'Username for confirmation',
            },
          },
        },
        response: {
          200: {
            description: 'Account successfully deleted',
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          400: {
            description: 'Bad request - Username confirmation mismatch',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          401: {
            description: 'Unauthorized - Invalid or missing token',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            description: 'User not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { confirmUsername } = request.body as { confirmUsername: string };

        // Fetch user to verify username
        const user = await userRepository.findById(userId);
        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        // Verify username matches
        if (user.username !== confirmUsername) {
          return reply.status(400).send({ error: 'Username confirmation does not match' });
        }

        // Delete all user data (cascading deletes handled by Prisma)
        await userRepository.delete(userId);

        fastify.log.info(
          { userId, username: user.username },
          'User account deleted (GDPR request)',
        );

        return reply.status(200).send({
          message: 'Your account and all associated data have been permanently deleted.',
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error deleting user account');
        return reply.status(500).send({ error: 'Failed to delete account' });
      }
    },
  );
};
