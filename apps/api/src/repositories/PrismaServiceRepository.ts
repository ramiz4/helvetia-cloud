import { Prisma, PrismaClient } from 'database';
import { inject, injectable } from 'tsyringe';
import {
  IServiceRepository,
  type RepoUrlCondition,
  Service,
  ServiceCreateInput,
  ServiceUpdateInput,
} from '../interfaces/index.js';

/**
 * Prisma implementation of IServiceRepository
 */
@injectable()
export class PrismaServiceRepository implements IServiceRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  async findById(id: string): Promise<Service | null> {
    return this.prisma.service.findUnique({
      where: { id },
      include: {
        environment: {
          include: {
            project: true,
          },
        },
      },
    });
  }

  async findByUserId(
    userId: string,
    options?: { take?: number; skip?: number },
  ): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { userId, deletedAt: null },
      take: options?.take,
      skip: options?.skip,
      include: {
        environment: {
          include: {
            project: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByNameAndUserId(name: string, userId: string): Promise<Service | null> {
    return this.prisma.service.findFirst({
      where: { name, userId, deletedAt: null },
    });
  }

  async findByNameAll(name: string, userId: string): Promise<Service | null> {
    return this.prisma.service.findFirst({
      where: { name, userId },
    });
  }

  async findByNameAndEnvironment(
    name: string,
    environmentId: string,
    userId: string,
  ): Promise<Service | null> {
    return this.prisma.service.findFirst({
      where: { name, environmentId, userId },
    });
  }

  async create(data: ServiceCreateInput): Promise<Service> {
    return this.prisma.service.create({
      data: {
        ...data,
        envVars:
          data.envVars !== undefined ? (data.envVars as Prisma.InputJsonValue) : Prisma.JsonNull,
        volumes:
          data.volumes !== undefined ? (data.volumes as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    }) as unknown as Promise<Service>;
  }

  async update(id: string, data: ServiceUpdateInput): Promise<Service> {
    return this.prisma.service.update({
      where: { id },
      data: {
        ...data,
        envVars: data.envVars !== undefined ? (data.envVars as Prisma.InputJsonValue) : undefined,
        volumes: data.volumes !== undefined ? (data.volumes as Prisma.InputJsonValue) : undefined,
      },
    }) as unknown as Promise<Service>;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.service.delete({ where: { id } });
  }

  async findByStatus(
    status: string,
    options?: { take?: number; skip?: number },
  ): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { status, deletedAt: null },
      take: options?.take,
      skip: options?.skip,
    });
  }

  async findAll(options?: { take?: number; skip?: number }): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { deletedAt: null },
      take: options?.take,
      skip: options?.skip,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByEnvironmentId(environmentId: string): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { environmentId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Service | null> {
    return this.prisma.service.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  async findByIdAndUserIdWithEnvironment(id: string, userId: string): Promise<Service | null> {
    return this.prisma.service.findFirst({
      where: { id, userId, deletedAt: null },
      include: { environment: { include: { project: true } } },
    });
  }

  async findBaseServiceByRepoUrl(repoUrlCondition: RepoUrlCondition): Promise<Service | null> {
    return this.prisma.service.findFirst({
      where: {
        ...repoUrlCondition,
        isPreview: false,
        deletedAt: null,
      },
    });
  }

  async findPreviewByPrNumberAndRepoUrl(
    prNumber: number,
    repoUrlCondition: RepoUrlCondition,
  ): Promise<Service | null> {
    return this.prisma.service.findFirst({
      where: {
        prNumber,
        ...repoUrlCondition,
        isPreview: true,
        deletedAt: null,
      },
    });
  }

  async findByRepoUrlAndBranch(
    repoUrlCondition: RepoUrlCondition,
    branch: string,
  ): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: {
        ...repoUrlCondition,
        branch,
        isPreview: false,
        deletedAt: null,
      },
    });
  }
}
