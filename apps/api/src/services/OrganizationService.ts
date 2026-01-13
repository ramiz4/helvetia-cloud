import { Organization, Role } from 'database';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import { ForbiddenError, NotFoundError } from '../errors';
import type { IOrganizationRepository } from '../interfaces/IOrganizationRepository';

@injectable()
export class OrganizationService {
  constructor(
    @inject(TOKENS.OrganizationRepository)
    private organizationRepository: IOrganizationRepository,
  ) {}

  async createOrganization(name: string, userId: string): Promise<Organization> {
    const slug = name
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/[^\w-]/g, '');

    // Check if slug exists
    const existing = await this.organizationRepository.findBySlug(slug);
    const finalSlug = existing ? `${slug}-${Math.random().toString(36).substring(2, 7)}` : slug;

    return this.organizationRepository.create({
      name,
      slug: finalSlug,
      userId,
    });
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    return this.organizationRepository.findByUserId(userId);
  }

  async getOrganizationById(id: string, userId: string) {
    const member = await this.organizationRepository.getMember(id, userId);
    if (!member) {
      throw new ForbiddenError('You are not a member of this organization');
    }

    const org = await this.organizationRepository.findById(id);
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    return org;
  }

  async addMember(
    organizationId: string,
    targetUserId: string,
    role: Role,
    requesterUserId: string,
  ) {
    await this.checkPermission(organizationId, requesterUserId, [Role.OWNER, Role.ADMIN]);

    return this.organizationRepository.addMember(organizationId, targetUserId, role);
  }

  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    role: Role,
    requesterUserId: string,
  ) {
    await this.checkPermission(organizationId, requesterUserId, [Role.OWNER, Role.ADMIN]);

    // Cannot downgrade the last owner
    if (role !== Role.OWNER) {
      const org = await this.organizationRepository.findById(organizationId);
      const owners = org?.members.filter((m) => m.role === Role.OWNER);
      if (owners?.length === 1 && owners[0].userId === targetUserId) {
        throw new ForbiddenError('Cannot change the role of the last owner');
      }
    }

    return this.organizationRepository.updateMemberRole(organizationId, targetUserId, role);
  }

  async removeMember(organizationId: string, targetUserId: string, requesterUserId: string) {
    if (targetUserId !== requesterUserId) {
      await this.checkPermission(organizationId, requesterUserId, [Role.OWNER, Role.ADMIN]);
    }

    // Cannot remove the last owner
    const org = await this.organizationRepository.findById(organizationId);
    const owners = org?.members.filter((m) => m.role === Role.OWNER);
    if (owners?.length === 1 && owners[0].userId === targetUserId) {
      throw new ForbiddenError('Cannot remove the last owner');
    }

    return this.organizationRepository.removeMember(organizationId, targetUserId);
  }

  private async checkPermission(organizationId: string, userId: string, allowedRoles: Role[]) {
    const member = await this.organizationRepository.getMember(organizationId, userId);
    if (!member || !allowedRoles.includes(member.role)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
  }

  async getRole(organizationId: string, userId: string): Promise<Role | null> {
    const member = await this.organizationRepository.getMember(organizationId, userId);
    return member?.role || null;
  }
}
