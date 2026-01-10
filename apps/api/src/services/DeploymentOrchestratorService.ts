import { Queue } from 'bullmq';
import { inject, injectable } from 'tsyringe';
import type { QueueDeploymentJobDto } from '../dto';
import { ForbiddenError, NotFoundError } from '../errors';
import type {
  Deployment,
  IDeploymentRepository,
  IServiceRepository,
  IUserRepository,
} from '../interfaces';
import { decrypt } from '../utils/crypto';

/**
 * DeploymentOrchestratorService
 * Handles business logic for deployment orchestration
 */
@injectable()
export class DeploymentOrchestratorService {
  constructor(
    @inject(Symbol.for('IServiceRepository'))
    private serviceRepository: IServiceRepository,
    @inject(Symbol.for('IDeploymentRepository'))
    private deploymentRepository: IDeploymentRepository,
    @inject(Symbol.for('IUserRepository'))
    private userRepository: IUserRepository,
    @inject('DeploymentQueue')
    private deploymentQueue: Queue,
  ) {}

  /**
   * Create a deployment and queue it for processing
   */
  async createAndQueueDeployment(
    serviceId: string,
    userId: string,
    commitHash?: string,
  ): Promise<Deployment> {
    // Verify service ownership
    const service = await this.serviceRepository.findById(serviceId);

    if (!service || service.deletedAt) {
      throw new NotFoundError('Service not found');
    }

    if (service.userId !== userId) {
      throw new ForbiddenError('Unauthorized access to service');
    }

    // Create deployment record
    const deployment = await this.deploymentRepository.create({
      serviceId,
      status: 'QUEUED',
      commitHash: commitHash || null,
    });

    // Prepare deployment job data
    const jobData = await this.prepareDeploymentJobData(service, deployment.id, userId);

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
    if (!service || service.userId !== userId) {
      throw new ForbiddenError('Unauthorized access to deployment');
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
      throw new ForbiddenError('Unauthorized access to service');
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
    service: any,
    deploymentId: string,
    userId: string,
  ): Promise<QueueDeploymentJobDto> {
    let repoUrl = service.repoUrl;

    // Inject GitHub token if available
    const user = await this.userRepository.findById(userId);
    if (user?.githubAccessToken && repoUrl && repoUrl.includes('github.com')) {
      const decryptedToken = decrypt(user.githubAccessToken);
      repoUrl = repoUrl.replace('https://', `https://${decryptedToken}@`);
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
      throw new ForbiddenError('Unauthorized access to service');
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
      throw new ForbiddenError('Unauthorized access to service');
    }

    return this.deploymentRepository.countByServiceId(serviceId);
  }
}
