import { PrismaClient } from 'database';
import { injectable } from 'tsyringe';
import {
  Environment,
  EnvironmentCreateInput,
  IProjectRepository,
  Project,
  ProjectCreateInput,
} from '../interfaces';

@injectable()
export class PrismaProjectRepository implements IProjectRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async findById(id: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        environments: {
          orderBy: { createdAt: 'asc' },
          include: {
            services: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!project) return null;

    return project as unknown as Project;
  }

  async findByUserId(userId: string): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      include: {
        environments: {
          orderBy: { createdAt: 'asc' },
          include: {
            services: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects as unknown as Project[];
  }

  async findByOrganizationId(organizationId: string): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { organizationId },
      include: {
        environments: {
          orderBy: { createdAt: 'asc' },
          include: {
            services: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects as unknown as Project[];
  }

  async findByNameAndUserId(name: string, userId: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
    });

    return project as unknown as Project | null;
  }

  async create(data: ProjectCreateInput): Promise<Project> {
    const project = await this.prisma.project.create({
      data: {
        name: data.name,
        userId: data.userId,
        organizationId: data.organizationId,
        environments: {
          create: {
            name: 'Production',
          },
        },
      },
      include: {
        environments: true,
      },
    });

    return project as unknown as Project;
  }

  async delete(id: string): Promise<void> {
    // Delete environments and services first (Prisma handles relations if set up,
    // but here we might want to manually clean up or use cascade delete in schema)
    // For now, let's assume cascade delete is not set but we'll use Prisma's ability
    await this.prisma.project.delete({
      where: { id },
    });
  }

  async findEnvironmentById(id: string): Promise<Environment | null> {
    const env = await this.prisma.environment.findUnique({
      where: { id },
      include: { services: true },
    });

    return env as unknown as Environment | null;
  }

  async createEnvironment(data: EnvironmentCreateInput): Promise<Environment> {
    const env = await this.prisma.environment.create({
      data: {
        name: data.name,
        projectId: data.projectId,
      },
    });

    return env as unknown as Environment;
  }

  async findEnvironmentsByProjectId(projectId: string): Promise<Environment[]> {
    const envs = await this.prisma.environment.findMany({
      where: { projectId },
      include: { services: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    return envs as unknown as Environment[];
  }
}
