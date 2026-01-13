import { Queue } from 'bullmq';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import type { QueueDeploymentJobDto } from '../dto';
import { ForbiddenError, NotFoundError } from '../errors';
import type {
  Deployment,
  IDeploymentOrchestratorService,
  IDeploymentRepository,
  IOrganizationRepository,
  IProjectRepository,
  IServiceRepository,
  IUserRepository,
  Service,
} from '../interfaces';
import { decrypt } from '../utils/crypto';

/**
 * DeploymentOrchestratorService
 * Handles business logic for deployment orchestration
 */
@injectable()
export class DeploymentOrchestratorService implements IDeploymentOrchestratorService {
  constructor(
    @inject(Symbol.for('IServiceRepository'))
    private serviceRepository: IServiceRepository,
    @inject(Symbol.for('IDeploymentRepository'))
    private deploymentRepository: IDeploymentRepository,
    @inject(Symbol.for('IUserRepository'))
    private userRepository: IUserRepository,
    @inject(Symbol.for('IProjectRepository'))
    private projectRepository: IProjectRepository,
    @inject(TOKENS.OrganizationRepository)
    private organizationRepository: IOrganizationRepository,
    @inject(Symbol.for('IDeploymentQueue'))
    private deploymentQueue: Queue,
  ) {}

  /**
   * Create a deployment and queue it for processing
   */
  async createAndQueueDeployment(
    serviceId: string,
    userId: string,
    commitHash?: string,
    requestId?: string,
  ): Promise<Deployment> {
    // Verify service ownership
    const service = await this.serviceRepository.findById(serviceId);

    if (!service || service.deletedAt) {
      throw new NotFoundError('Service not found');
    }

    if (service.userId !== userId) {
      if (service.environment?.project?.organizationId) {
        const member = await this.organizationRepository.getMember(
          service.environment.project.organizationId,
          userId,
        );
        if (!member) {
          throw new NotFoundError('Service not found'); // Use 404 to avoid leaking
        }
      } else {
        throw new NotFoundError('Service not found');
      }
    }

    // Create deployment record
    const deployment = await this.deploymentRepository.create({
      serviceId,
      status: 'QUEUED',
      commitHash: commitHash || null,
    });

    // Prepare deployment job data
    const jobData = await this.prepareDeploymentJobData(service, deployment.id, userId, requestId);

    // Queue the deployment job
    await this.deploymentQueue.add('build', jobData);

    return deployment;
  }

  /**
   * Get deployment by ID with ownership validation
   */
  async getDeployment(deploymentId: string, userId: string): Promise<Deployment> {
    const deployment = await this.deploymentRepository.findById(deploymentId);

    if (!deployment) {
      throw new NotFoundError('Deployment not found');
    }

    // Verify service ownership
    const service = await this.serviceRepository.findById(deployment.serviceId);
    if (!service) {
      throw new ForbiddenError('Unauthorized access to deployment');
    }

    if (service.userId !== userId) {
      if (service.environment?.project?.organizationId) {
        const member = await this.organizationRepository.getMember(
          service.environment.project.organizationId,
          userId,
        );
        if (!member) {
          throw new ForbiddenError('Unauthorized access to deployment');
        }
      } else {
        throw new ForbiddenError('Unauthorized access to deployment');
      }
    }

    return deployment;
  }

  /**
   * Get deployments for a service
   */
  async getServiceDeployments(
    serviceId: string,
    userId: string,
    options?: { take?: number; skip?: number },
  ): Promise<Deployment[]> {
    // Verify service ownership
    const service = await this.serviceRepository.findById(serviceId);

    if (!service || service.deletedAt) {
      throw new NotFoundError('Service not found');
    }

    if (service.userId !== userId) {
      if (service.environment?.project?.organizationId) {
        const member = await this.organizationRepository.getMember(
          service.environment.project.organizationId,
          userId,
        );
        if (!member) {
          throw new NotFoundError('Service not found');
        }
      } else {
        throw new NotFoundError('Service not found');
      }
    }

    return this.deploymentRepository.findByServiceId(serviceId, options);
  }

  /**
   * Update deployment status
   */
  async updateDeploymentStatus(
    deploymentId: string,
    status: string,
    logs?: string,
  ): Promise<Deployment> {
    return this.deploymentRepository.update(deploymentId, {
      status,
      logs: logs || undefined,
    });
  }

  /**
   * Prepare deployment job data with GitHub token injection
   */
  private async prepareDeploymentJobData(
    service: Service,
    deploymentId: string,
    userId: string,
    requestId?: string,
  ): Promise<QueueDeploymentJobDto> {
    let repoUrl = service.repoUrl;

    // Inject GitHub token if available
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    let githubToken: string | undefined;

    if (user?.githubAccessToken) {
      const decryptedToken = decrypt(user.githubAccessToken);
      githubToken = decryptedToken;

      if (repoUrl && repoUrl.includes('github.com')) {
        repoUrl = repoUrl.replace('https://', `https://${decryptedToken}@`);
      }
    }

    // Fetch project and environment names for grouping
    let environmentName: string | undefined;
    let projectName: string | undefined;

    if (service.environmentId) {
      const environment = await this.projectRepository.findEnvironmentById(service.environmentId);
      if (environment) {
        environmentName = environment.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const project = await this.projectRepository.findById(environment.projectId);
        if (project) {
          projectName = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        }
      }
    }

    return {
      deploymentId,
      serviceId: service.id,
      repoUrl,
      branch: service.branch,
      buildCommand: service.buildCommand,
      startCommand: service.startCommand,
      serviceName: service.name,
      port: service.port,
      envVars: service.envVars,
      customDomain: service.customDomain,
      type: service.type,
      staticOutputDir: service.staticOutputDir,
      volumes: service.volumes as string[] | undefined,
      githubToken,
      projectName,
      environmentName,
      username: user.username,
      requestId, // Include request ID for tracing
    };
  }

  /**
   * Delete all deployments for a service
   */
  async deleteServiceDeployments(serviceId: string, userId: string): Promise<void> {
    // Verify service ownership
    const service = await this.serviceRepository.findById(serviceId);

    if (!service) {
      throw new NotFoundError('Service not found');
    }

    if (service.userId !== userId) {
      if (service.environment?.project?.organizationId) {
        const member = await this.organizationRepository.getMember(
          service.environment.project.organizationId,
          userId,
        );
        if (!member) {
          throw new NotFoundError('Service not found');
        }
      } else {
        throw new NotFoundError('Service not found');
      }
    }

    await this.deploymentRepository.deleteByServiceId(serviceId);
  }

  /**
   * Get deployment count for a service
   */
  async getDeploymentCount(serviceId: string, userId: string): Promise<number> {
    // Verify service ownership
    const service = await this.serviceRepository.findById(serviceId);

    if (!service || service.deletedAt) {
      throw new NotFoundError('Service not found');
    }

    if (service.userId !== userId) {
      if (service.environment?.project?.organizationId) {
        const member = await this.organizationRepository.getMember(
          service.environment.project.organizationId,
          userId,
        );
        if (!member) {
          throw new NotFoundError('Service not found');
        }
      } else {
        throw new NotFoundError('Service not found');
      }
    }

    return this.deploymentRepository.countByServiceId(serviceId);
  }
}
