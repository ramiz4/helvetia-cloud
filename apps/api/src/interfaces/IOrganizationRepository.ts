import type { Organization, OrganizationMember, Role } from 'database';

export interface IOrganizationRepository {
  create(data: { name: string; slug: string; userId: string }): Promise<Organization>;
  findById(id: string): Promise<
    | (Organization & {
        members: (OrganizationMember & {
          user: { id: string; username: string; avatarUrl: string | null };
        })[];
      })
    | null
  >;
  findBySlug(slug: string): Promise<Organization | null>;
  findByUserId(userId: string): Promise<Organization[]>;
  update(id: string, data: Partial<{ name: string; slug: string }>): Promise<Organization>;
  delete(id: string): Promise<void>;

  addMember(organizationId: string, userId: string, role: Role): Promise<OrganizationMember>;
  updateMemberRole(organizationId: string, userId: string, role: Role): Promise<OrganizationMember>;
  removeMember(organizationId: string, userId: string): Promise<void>;
  getMember(organizationId: string, userId: string): Promise<OrganizationMember | null>;
}
