import type { Deployment } from './index.js';

/**
 * Interface for DeploymentOrchestratorService
 * Handles business logic for deployment orchestration
 */
export interface IDeploymentOrchestratorService {
  /**
   * Create a deployment and queue it for processing
   */
  createAndQueueDeployment(
    serviceId: string,
    userId: string,
    commitHash?: string,
    requestId?: string,
  ): Promise<Deployment>;

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string, userId: string): Promise<Deployment>;

  /**
   * Get deployments for a service
   */
  getServiceDeployments(
    serviceId: string,
    userId: string,
    options?: { take?: number; skip?: number },
  ): Promise<Deployment[]>;

  /**
   * Update deployment status
   */
  updateDeploymentStatus(deploymentId: string, status: string, logs?: string): Promise<Deployment>;

  /**
   * Delete all deployments for a service
   */
  deleteServiceDeployments(serviceId: string, userId: string): Promise<void>;

  /**
   * Get deployment count for a service
   */
  getDeploymentCount(serviceId: string, userId: string): Promise<number>;
}
