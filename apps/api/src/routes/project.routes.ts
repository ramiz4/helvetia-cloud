import { FastifyInstance } from 'fastify';
import { ProjectController } from '../controllers/ProjectController';
import { getContainer, TOKENS } from '../di/container';

export async function projectRoutes(fastify: FastifyInstance) {
  const container = getContainer();
  const controller = container.resolve<ProjectController>(TOKENS.ProjectController);

  fastify.get('/projects', (req, reply) => controller.listProjects(req, reply));
  fastify.get<{ Params: { id: string } }>('/projects/:id', (req, reply) =>
    controller.getProject(req, reply),
  );
  fastify.post<{ Body: { name: string } }>('/projects', (req, reply) =>
    controller.createProject(req, reply),
  );
  fastify.delete<{ Params: { id: string } }>('/projects/:id', (req, reply) =>
    controller.deleteProject(req, reply),
  );

  fastify.post<{ Params: { id: string }; Body: { name: string } }>(
    '/projects/:id/environments',
    (req, reply) => controller.createEnvironment(req, reply),
  );
}
