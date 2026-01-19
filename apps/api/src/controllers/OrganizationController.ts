import { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import { TOKENS } from '../di/tokens.js';
import { ValidationError } from '../errors/index.js';
import { OrganizationService } from '../services/OrganizationService.js';
import { formatZodError } from '../utils/errorFormatting.js';

const createOrganizationSchema = z.object({
  name: z.string().min(3).max(50),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['OWNER', 'ADMIN', 'DEVELOPER', 'MEMBER', 'VIEWER']),
});

@injectable()
export class OrganizationController {
  constructor(
    @inject(TOKENS.OrganizationService)
    private organizationService: OrganizationService,
  ) {}

  async createOrganization(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = createOrganizationSchema.parse(request.body);
      const userId = request.user.id;

      const org = await this.organizationService.createOrganization(name, userId);
      return reply.status(201).send(org);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation failed', formatZodError(error));
      }
      throw error;
    }
  }

  async listOrganizations(request: FastifyRequest, _reply: FastifyReply) {
    const userId = request.user.id;
    return this.organizationService.getUserOrganizations(userId);
  }

  async getOrganization(request: FastifyRequest, _reply: FastifyReply) {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const userId = request.user.id;

      return await this.organizationService.getOrganizationById(id, userId);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation failed', formatZodError(error));
      }
      throw error;
    }
  }

  async addMember(request: FastifyRequest, reply: FastifyReply) {
    try {
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation failed', formatZodError(error));
      }
      throw error;
    }
  }

  async updateMember(request: FastifyRequest, _reply: FastifyReply) {
    try {
      const { id: organizationId, userId: targetUserId } = z
        .object({
          id: z.string().uuid(),
          userId: z.string().uuid(),
        })
        .parse(request.params);
      const { role } = z
        .object({ role: z.enum(['OWNER', 'ADMIN', 'DEVELOPER', 'MEMBER', 'VIEWER']) })
        .parse(request.body);
      const requesterUserId = request.user.id;

      return await this.organizationService.updateMemberRole(
        organizationId,
        targetUserId,
        role,
        requesterUserId,
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation failed', formatZodError(error));
      }
      throw error;
    }
  }

  async removeMember(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: organizationId, userId: targetUserId } = z
        .object({
          id: z.string().uuid(),
          userId: z.string().uuid(),
        })
        .parse(request.params);
      const requesterUserId = request.user.id;

      await this.organizationService.removeMember(organizationId, targetUserId, requesterUserId);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation failed', formatZodError(error));
      }
      throw error;
    }
  }
}
