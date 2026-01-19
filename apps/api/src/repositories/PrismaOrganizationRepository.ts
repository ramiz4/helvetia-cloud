import { PrismaClient, Role } from 'database';
import { inject, injectable } from 'tsyringe';
import type { IOrganizationRepository } from '../interfaces/IOrganizationRepository.js';

@injectable()
export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  async create(data: { name: string; slug: string; userId: string }) {
    return this.prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        members: {
          create: {
            userId: data.userId,
            role: Role.OWNER,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.organization.findUnique({
      where: { slug },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
    });
  }

  async update(id: string, data: Partial<{ name: string; slug: string }>) {
    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.prisma.organization.delete({
      where: { id },
    });
  }

  async addMember(organizationId: string, userId: string, role: Role) {
    return this.prisma.organizationMember.create({
      data: {
        organizationId,
        userId,
        role,
      },
    });
  }

  async updateMemberRole(organizationId: string, userId: string, role: Role) {
    return this.prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      data: {
        role,
      },
    });
  }

  async removeMember(organizationId: string, userId: string) {
    await this.prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });
  }

  async getMember(organizationId: string, userId: string) {
    return this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });
  }
}
