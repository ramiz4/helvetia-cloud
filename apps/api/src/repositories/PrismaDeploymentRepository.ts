import { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'tsyringe';
import {
  Deployment,
  DeploymentCreateInput,
  DeploymentUpdateInput,
  IDeploymentRepository,
} from '../interfaces';

/**
 * Prisma implementation of IDeploymentRepository
 */
@injectable()
export class PrismaDeploymentRepository implements IDeploymentRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  async findById(id: string): Promise<Deployment | null> {
    return this.prisma.deployment.findUnique({ where: { id } });
  }

  async findByServiceId(
    serviceId: string,
    options?: { take?: number; skip?: number },
  ): Promise<Deployment[]> {
    return this.prisma.deployment.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      take: options?.take,
      skip: options?.skip,
    });
  }

  async create(data: DeploymentCreateInput): Promise<Deployment> {
    return this.prisma.deployment.create({ data });
  }

  async update(id: string, data: DeploymentUpdateInput): Promise<Deployment> {
    return this.prisma.deployment.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.deployment.delete({ where: { id } });
  }

  async deleteByServiceId(serviceId: string): Promise<void> {
    await this.prisma.deployment.deleteMany({ where: { serviceId } });
  }

  async countByServiceId(serviceId: string): Promise<number> {
    return this.prisma.deployment.count({ where: { serviceId } });
  }
}
