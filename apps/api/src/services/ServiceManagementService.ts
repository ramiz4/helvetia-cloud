import crypto from 'crypto';
import { inject, injectable } from 'tsyringe';
import type { CreateServiceDto, UpdateServiceDto } from '../dto';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import type {
  IContainerOrchestrator,
  IDeploymentRepository,
  IServiceRepository,
  IUserRepository,
  Service,
} from '../interfaces';

/**
 * ServiceManagementService
 * Handles business logic for service CRUD operations
 */
@injectable()
export class ServiceManagementService {
  constructor(
    @inject(Symbol.for('IServiceRepository'))
    private serviceRepository: IServiceRepository,
    @inject(Symbol.for('IDeploymentRepository'))
    private deploymentRepository: IDeploymentRepository,
    @inject(Symbol.for('IUserRepository'))
    private userRepository: IUserRepository,
    @inject(Symbol.for('IContainerOrchestrator'))
    private containerOrchestrator: IContainerOrchestrator,
  ) {}

  /**
   * Get all services for a user
   */
  async getUserServices(userId: string): Promise<Service[]> {
    return this.serviceRepository.findByUserId(userId);
  }

  /**
   * Get a single service by ID
   * Validates ownership
   */
  async getServiceById(serviceId: string, userId: string): Promise<Service> {
    const service = await this.serviceRepository.findById(serviceId);

    if (!service || service.deletedAt) {
      throw new NotFoundError('Service not found');
    }

    if (service.userId !== userId) {
      throw new ForbiddenError('Unauthorized access to service');
    }

    return service;
  }

  /**
   * Create a new service or update existing one
   * Handles type-specific defaults (POSTGRES, REDIS, MYSQL, STATIC)
   */
  async createOrUpdateService(dto: CreateServiceDto): Promise<Service> {
    const { name, userId, type = 'DOCKER', port, envVars = {} } = dto;

    // Check if another user owns this service name
    const existingByOtherUser = await this.serviceRepository.findByNameAndUserId(name, '');
    if (
      existingByOtherUser &&
      existingByOtherUser.userId !== userId &&
      !existingByOtherUser.deletedAt
    ) {
      throw new ForbiddenError('Service name taken by another user');
    }

    // Determine final port and environment variables based on service type
    const { finalPort, finalEnvVars } = this.getServiceDefaults(type, port, envVars);

    // Check if service exists for this user (including soft-deleted ones)
    const existing = await this.serviceRepository.findByNameAll(name, userId);

    if (existing) {
      // Update existing service (resurrect if soft-deleted)
      return this.serviceRepository.update(existing.id, {
        repoUrl: dto.repoUrl || null,
        branch: dto.branch || 'main',
        buildCommand: dto.buildCommand,
        startCommand: dto.startCommand,
        port: finalPort,
        customDomain: dto.customDomain,
        type,
        staticOutputDir: dto.staticOutputDir || 'dist',
        envVars: finalEnvVars,
        deletedAt: null,
      });
    } else {
      // Create new service
      return this.serviceRepository.create({
        name,
        repoUrl: dto.repoUrl || null,
        branch: dto.branch || 'main',
        buildCommand: dto.buildCommand,
        startCommand: dto.startCommand,
        port: finalPort,
        userId,
        customDomain: dto.customDomain,
        type,
        staticOutputDir: dto.staticOutputDir || 'dist',
        envVars: finalEnvVars,
      });
    }
  }

  /**
   * Update an existing service
   */
  async updateService(serviceId: string, userId: string, dto: UpdateServiceDto): Promise<Service> {
    // Verify ownership
    await this.getServiceById(serviceId, userId);

    return this.serviceRepository.update(serviceId, dto);
  }

  /**
   * Soft delete a service (marks as deleted)
   * Validates ownership and delete protection
   */
  async softDeleteService(serviceId: string, userId: string): Promise<void> {
    const service = await this.getServiceById(serviceId, userId);

    if (service.deleteProtected) {
      throw new ForbiddenError('This service is protected from deletion. Remove protection first.');
    }

    await this.serviceRepository.update(serviceId, {
      deletedAt: new Date(),
    });

    // Cleanup infrastructure resources (Docker containers)
    // We do this immediately to free up ports and names, even if DB record stays for 30 days
    try {
      const containersForService = await this.containerOrchestrator.listContainers({
        all: true,
        filters: {
          label: [`helvetia.serviceId=${serviceId}`],
        },
      });

      // Also check for COMPOSE services which might use project name instead of helvetia.serviceId label for some containers
      if (service.type === 'COMPOSE') {
        const composeContainers = await this.containerOrchestrator.listContainers({
          all: true,
          filters: {
            label: [`com.docker.compose.project=${service.name}`],
          },
        });
        // Merge without duplicates
        for (const cc of composeContainers) {
          if (!containersForService.find((c) => c.id === cc.id)) {
            containersForService.push(cc);
          }
        }
      }

      await Promise.all(
        containersForService.map(async (c) => {
          try {
            const container = await this.containerOrchestrator.getContainer(c.id);
            if (c.state === 'running' || c.state === 'restarting') {
              await this.containerOrchestrator.stopContainer(container, 5);
            }
            await this.containerOrchestrator.removeContainer(container, { force: true });
          } catch (err) {
            console.error(`Failed to remove container ${c.id} for service ${serviceId}:`, err);
          }
        }),
      );
    } catch (err) {
      console.error(`Error cleaning up resources for service ${serviceId}:`, err);
      // We continue since the DB is already updated
    }
  }

  /**
   * Recover a soft-deleted service
   */
  async recoverService(serviceId: string, userId: string): Promise<Service> {
    const service = await this.serviceRepository.findById(serviceId);

    if (!service) {
      throw new NotFoundError('Service not found');
    }

    if (service.userId !== userId) {
      throw new ForbiddenError('Unauthorized access to service');
    }

    if (!service.deletedAt) {
      throw new ConflictError('Service is not deleted');
    }

    return this.serviceRepository.update(serviceId, {
      deletedAt: null,
    });
  }

  /**
   * Toggle delete protection for a service
   */
  async toggleDeleteProtection(
    serviceId: string,
    userId: string,
    protected_: boolean,
  ): Promise<Service> {
    await this.getServiceById(serviceId, userId);

    return this.serviceRepository.update(serviceId, {
      deleteProtected: protected_,
    });
  }

  /**
   * Hard delete a service and all its resources
   * This is intended to be called after containers/images cleanup
   */
  async hardDeleteService(serviceId: string, userId?: string): Promise<void> {
    const service = await this.serviceRepository.findById(serviceId);
    if (!service) return;

    // Verify ownership if userId is provided
    if (userId && service.userId !== userId) {
      throw new ForbiddenError('Unauthorized service deletion attempt');
    }

    // Delete deployments first
    await this.deploymentRepository.deleteByServiceId(serviceId);

    // Delete service
    await this.serviceRepository.delete(serviceId);
  }

  /**
   * Get service defaults based on type
   * Returns appropriate port and environment variables
   */
  private getServiceDefaults(
    type: string,
    port?: number,
    envVars: Record<string, string> = {},
  ): { finalPort: number; finalEnvVars: Record<string, string> } {
    let finalPort = port || 3000;
    let finalEnvVars = { ...envVars };

    switch (type) {
      case 'STATIC':
        finalPort = 80;
        break;

      case 'POSTGRES':
        finalPort = 5444;
        if (!finalEnvVars.POSTGRES_PASSWORD) {
          finalEnvVars = {
            ...finalEnvVars,
            POSTGRES_USER: 'postgres',
            POSTGRES_PASSWORD: crypto.randomBytes(16).toString('hex'),
            POSTGRES_DB: 'app',
          };
        }
        break;

      case 'REDIS':
        finalPort = 6379;
        if (!finalEnvVars.REDIS_PASSWORD) {
          finalEnvVars = {
            ...finalEnvVars,
            REDIS_PASSWORD: crypto.randomBytes(16).toString('hex'),
          };
        }
        break;

      case 'MYSQL':
        finalPort = 3306;
        if (!finalEnvVars.MYSQL_ROOT_PASSWORD) {
          finalEnvVars = {
            ...finalEnvVars,
            MYSQL_ROOT_PASSWORD: crypto.randomBytes(16).toString('hex'),
            MYSQL_DATABASE: 'app',
          };
        }
        break;

      default:
        // DOCKER or COMPOSE - use provided port or default
        finalPort = port || 3000;
        break;
    }

    return { finalPort, finalEnvVars };
  }

  /**
   * Check if a service name is available for a user
   */
  async isServiceNameAvailable(name: string, userId: string): Promise<boolean> {
    const existing = await this.serviceRepository.findByNameAndUserId(name, userId);
    return !existing || !!existing.deletedAt;
  }

  /**
   * Get all deployments for a service
   */
  async getServiceDeployments(
    serviceId: string,
    userId: string,
    options?: { take?: number; skip?: number },
  ) {
    // Verify ownership
    await this.getServiceById(serviceId, userId);

    return this.deploymentRepository.findByServiceId(serviceId, options);
  }
}
