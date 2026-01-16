import type { FastifyPluginAsync } from 'fastify';
import { OrganizationController } from '../controllers/OrganizationController';
import { resolve, TOKENS } from '../di';

export const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<OrganizationController>(TOKENS.OrganizationController);

  fastify.post(
    '/organizations',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Create an organization',
        description: 'Create a new organization with the authenticated user as owner.',
        body: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Organization name',
              example: 'My Organization',
            },
            slug: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              pattern: '^[a-z0-9-]+$',
              description: 'Organization slug (URL-friendly identifier)',
              example: 'my-organization',
            },
          },
        },
        response: {
          201: {
            description: 'Organization created successfully',
            type: 'object',
          },
          400: {
            description: 'Bad request - validation error',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          409: {
            description: 'Conflict - organization slug already exists',
            type: 'object',
          },
        },
      },
    },
    (req, _reply) => controller.createOrganization(req, _reply),
  );

  fastify.get(
    '/organizations',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'List organizations',
        description: 'List all organizations the authenticated user belongs to.',
        response: {
          200: {
            description: 'List of organizations',
            type: 'array',
            items: {
              type: 'object',
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
        },
      },
    },
    (req, _reply) => controller.listOrganizations(req, _reply),
  );

  fastify.get(
    '/organizations/:id',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Get organization by ID',
        description: 'Retrieve organization details including members.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Organization ID',
            },
          },
        },
        response: {
          200: {
            description: 'Organization details',
            allOf: [
              { type: 'object' },
              {
                type: 'object',
                properties: {
                  members: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                          format: 'uuid',
                        },
                        userId: {
                          type: 'string',
                          format: 'uuid',
                        },
                        role: {
                          type: 'string',
                          enum: ['OWNER', 'ADMIN', 'MEMBER'],
                          example: 'MEMBER',
                        },
                        user: {
                          type: 'object',
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          403: {
            description: 'Forbidden - not a member',
            type: 'object',
          },
          404: {
            description: 'Organization not found',
            type: 'object',
          },
        },
      },
    },
    (req, _reply) => controller.getOrganization(req, _reply),
  );

  fastify.post(
    '/organizations/:id/members',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Add organization member',
        description: 'Add a new member to the organization.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Organization ID',
            },
          },
        },
        body: {
          type: 'object',
          required: ['userId', 'role'],
          properties: {
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'User ID to add',
            },
            role: {
              type: 'string',
              enum: ['ADMIN', 'MEMBER'],
              description: 'Member role',
              example: 'MEMBER',
            },
          },
        },
        response: {
          201: {
            description: 'Member added successfully',
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              userId: {
                type: 'string',
                format: 'uuid',
              },
              organizationId: {
                type: 'string',
                format: 'uuid',
              },
              role: {
                type: 'string',
                enum: ['ADMIN', 'MEMBER'],
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          403: {
            description: 'Forbidden - insufficient permissions',
            type: 'object',
          },
          404: {
            description: 'Organization or user not found',
            type: 'object',
          },
        },
      },
    },
    (req, reply) => controller.addMember(req, reply),
  );

  fastify.patch(
    '/organizations/:id/members/:userId',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Update member role',
        description: 'Update the role of an organization member.',
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Organization ID',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'User ID',
            },
          },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: {
              type: 'string',
              enum: ['ADMIN', 'MEMBER'],
              description: 'New member role',
              example: 'ADMIN',
            },
          },
        },
        response: {
          200: {
            description: 'Member role updated',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Member role updated successfully',
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          403: {
            description: 'Forbidden - insufficient permissions',
            type: 'object',
          },
          404: {
            description: 'Member not found',
            type: 'object',
          },
        },
      },
    },
    (req, _reply) => controller.updateMember(req, _reply),
  );

  fastify.delete(
    '/organizations/:id/members/:userId',
    {
      schema: {
        tags: ['Organizations'],
        summary: 'Remove organization member',
        description: 'Remove a member from the organization.',
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Organization ID',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'User ID to remove',
            },
          },
        },
        response: {
          200: {
            description: 'Member removed successfully',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Member removed successfully',
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          403: {
            description: 'Forbidden - insufficient permissions or cannot remove last owner',
            type: 'object',
          },
          404: {
            description: 'Member not found',
            type: 'object',
          },
        },
      },
    },
    (req, reply) => controller.removeMember(req, reply),
  );
};
