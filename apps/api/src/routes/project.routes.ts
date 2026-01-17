import { FastifyInstance } from 'fastify';
import { ProjectController } from '../controllers/ProjectController';
import { getContainer, TOKENS } from '../di/container';

export async function projectRoutes(fastify: FastifyInstance) {
  const container = getContainer();
  const controller = container.resolve<ProjectController>(TOKENS.ProjectController);

  fastify.get(
    '/projects',
    {
      schema: {
        tags: ['Projects'],
        summary: 'List all projects',
        description: 'Retrieve all projects for the authenticated user.',
        response: {
          200: {
            description: 'List of projects',
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
    (req, reply) => controller.listProjects(req, reply),
  );

  fastify.get<{ Params: { id: string } }>(
    '/projects/:id',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Get project by ID',
        description: 'Retrieve a specific project by its ID.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Project ID',
            },
          },
        },
        response: {
          200: {
            description: 'Project details',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Project not found',
            type: 'object',
          },
        },
      },
    },
    (req, reply) => controller.getProject(req, reply),
  );

  fastify.post<{ Body: { name: string } }>(
    '/projects',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Create a new project',
        description: 'Create a new project for the authenticated user.',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Project name',
              example: 'My Project',
            },
          },
        },
        response: {
          201: {
            description: 'Project created successfully',
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
        },
      },
    },
    (req, reply) => controller.createProject(req, reply),
  );

  fastify.delete<{ Params: { id: string } }>(
    '/projects/:id',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Delete a project',
        description: 'Delete a project and all its associated resources.',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Project ID',
            },
          },
        },
        response: {
          200: {
            description: 'Project deleted successfully',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Project deleted successfully',
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Project not found',
            type: 'object',
          },
        },
      },
    },
    (req, reply) => controller.deleteProject(req, reply),
  );

  fastify.post<{ Params: { id: string }; Body: { name: string } }>(
    '/projects/:id/environments',
    {
      schema: {
        tags: ['Projects'],
        summary: 'Create project environment',
        description: 'Create a new environment for a project (e.g., staging, production).',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Project ID',
            },
          },
        },
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              description: 'Environment name',
              example: 'staging',
            },
          },
        },
        response: {
          201: {
            description: 'Environment created successfully',
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
              name: {
                type: 'string',
                example: 'staging',
              },
              projectId: {
                type: 'string',
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
          404: {
            description: 'Project not found',
            type: 'object',
          },
        },
      },
    },
    (req, reply) => controller.createEnvironment(req, reply),
  );
}
