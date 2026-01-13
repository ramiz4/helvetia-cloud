import { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import { TOKENS } from '../di/tokens';
import { OrganizationService } from '../services/OrganizationService';

const createOrganizationSchema = z.object({
  name: z.string().min(3).max(50),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

@injectable()
export class OrganizationController {
  constructor(
    @inject(TOKENS.OrganizationService)
    private organizationService: OrganizationService,
  ) {}

  async createOrganization(request: FastifyRequest, reply: FastifyReply) {
    const { name } = createOrganizationSchema.parse(request.body);
    const userId = request.user.id;

    const org = await this.organizationService.createOrganization(name, userId);
    return reply.status(201).send(org);
  }

  async listOrganizations(request: FastifyRequest, _reply: FastifyReply) {
    const userId = request.user.id;
    return this.organizationService.getUserOrganizations(userId);
  }

  async getOrganization(request: FastifyRequest, _reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const userId = request.user.id;

    return this.organizationService.getOrganizationById(id, userId);
  }

  async addMember(request: FastifyRequest, reply: FastifyReply) {
    const { id: organizationId } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { userId: targetUserId, role } = addMemberSchema.parse(request.body);
    const requesterUserId = request.user.id;

    const member = await this.organizationService.addMember(
      organizationId,
      targetUserId,
      role,
      requesterUserId,
    );
    return reply.status(201).send(member);
  }

  async updateMember(request: FastifyRequest, _reply: FastifyReply) {
    const { id: organizationId, userId: targetUserId } = z
      .object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(request.params);
    const { role } = z
      .object({ role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']) })
      .parse(request.body);
    const requesterUserId = request.user.id;

    return this.organizationService.updateMemberRole(
      organizationId,
      targetUserId,
      role,
      requesterUserId,
    );
  }

  async removeMember(request: FastifyRequest, reply: FastifyReply) {
    const { id: organizationId, userId: targetUserId } = z
      .object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(request.params);
    const requesterUserId = request.user.id;

    await this.organizationService.removeMember(organizationId, targetUserId, requesterUserId);
    return reply.status(204).send();
  }
}
