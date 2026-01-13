import type { FastifyPluginAsync } from 'fastify';
import { OrganizationController } from '../controllers/OrganizationController';
import { resolve, TOKENS } from '../di';

export const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<OrganizationController>(TOKENS.OrganizationController);

  fastify.post('/organizations', (req, _reply) => controller.createOrganization(req, _reply));
  fastify.get('/organizations', (req, _reply) => controller.listOrganizations(req, _reply));
  fastify.get('/organizations/:id', (req, _reply) => controller.getOrganization(req, _reply));

  fastify.post('/organizations/:id/members', (req, reply) => controller.addMember(req, reply));
  fastify.patch('/organizations/:id/members/:userId', (req, _reply) =>
    controller.updateMember(req, _reply),
  );
  fastify.delete('/organizations/:id/members/:userId', (req, reply) =>
    controller.removeMember(req, reply),
  );
};
