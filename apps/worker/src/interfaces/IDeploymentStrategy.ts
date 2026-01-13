import { Job } from 'bullmq';
import Docker from 'dockerode';

/**
 * Result of a deployment operation
 */
export interface DeploymentResult {
  imageTag: string;
  buildLogs: string;
  success: boolean;
}

/**
 * Context passed to deployment strategies
 */
export interface DeploymentContext {
  job: Job;
  docker: Docker;
  deploymentId: string;
  serviceId: string;
  serviceName: string;
  repoUrl: string;
  branch: string;
  buildCommand?: string;
  startCommand?: string;
  port?: number;
  envVars?: Record<string, string>;
  customDomain?: string;
  staticOutputDir?: string;
  type: string;
  githubToken?: string;
  projectName?: string;
  environmentName?: string;
  username?: string;
  volumes?: string[];
  onLog?: (log: string) => void;
}

/**
 * Strategy interface for different deployment types
 * Implements Strategy Pattern to handle various service deployment scenarios
 */
export interface IDeploymentStrategy {
  /**
   * Execute the deployment for this strategy type
   * @param context - Deployment context containing all necessary information
   * @returns Promise resolving to deployment result
   */
  deploy(context: DeploymentContext): Promise<DeploymentResult>;

  /**
   * Check if this strategy can handle the given service type
   * @param type - Service type string
   * @returns boolean indicating if strategy supports this type
   */
  canHandle(type: string): boolean;
}
