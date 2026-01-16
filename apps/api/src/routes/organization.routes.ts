import { Role } from 'database';
import type { FastifyPluginAsync } from 'fastify';
import { OrganizationController } from '../controllers/OrganizationController';
import { resolve, TOKENS } from '../di';
import { requireOrganizationPermission } from '../middleware';

export const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = resolve<OrganizationController>(TOKENS.OrganizationController);

  fastify.post('/organizations', (req, _reply) => controller.createOrganization(req, _reply));
  fastify.get('/organizations', (req, _reply) => controller.listOrganizations(req, _reply));
  fastify.get('/organizations/:id', (req, _reply) => controller.getOrganization(req, _reply));

  // Member management - requires ADMIN or OWNER
  fastify.post(
    '/organizations/:id/members',
    { preHandler: [requireOrganizationPermission(Role.ADMIN)] },
    (req, reply) => controller.addMember(req, reply),
  );
  fastify.patch(
    '/organizations/:id/members/:userId',
    { preHandler: [requireOrganizationPermission(Role.ADMIN)] },
    (req, _reply) => controller.updateMember(req, _reply),
  );
  fastify.delete(
    '/organizations/:id/members/:userId',
    { preHandler: [requireOrganizationPermission(Role.ADMIN)] },
    (req, reply) => controller.removeMember(req, reply),
  );
};
