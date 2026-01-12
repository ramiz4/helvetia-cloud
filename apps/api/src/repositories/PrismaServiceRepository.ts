import { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'tsyringe';
import { IServiceRepository, Service, ServiceCreateInput, ServiceUpdateInput } from '../interfaces';

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
    return this.prisma.service.create({ data });
  }

  async update(id: string, data: ServiceUpdateInput): Promise<Service> {
    return this.prisma.service.update({
      where: { id },
      data,
    });
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
}
