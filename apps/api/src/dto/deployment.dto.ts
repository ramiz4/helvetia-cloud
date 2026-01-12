/**
 * Data Transfer Objects for Deployment operations
 */

/**
 * DTO for creating a deployment
 */
export interface CreateDeploymentDto {
  serviceId: string;
  commitHash?: string | null;
  status?: string;
}

/**
 * DTO for deployment with service details
 */
export interface DeploymentWithServiceDto {
  id: string;
  serviceId: string;
  status: string;
  logs: string | null;
  commitHash: string | null;
  imageTag: string | null;
  createdAt: Date;
  updatedAt: Date;
  service?: {
    id: string;
    name: string;
    type: string;
    branch: string;
    repoUrl: string | null;
    buildCommand: string | null;
    startCommand: string | null;
    port: number;
    envVars: unknown;
    customDomain: string | null;
    staticOutputDir: string | null;
  };
}

/**
 * DTO for queuing a deployment job
 */
export interface QueueDeploymentJobDto {
  deploymentId: string;
  serviceId: string;
  repoUrl: string | null;
  branch: string;
  buildCommand: string | null;
  startCommand: string | null;
  serviceName: string;
  port: number;
  envVars: unknown;
  customDomain: string | null;
  type: string;
  staticOutputDir: string | null;
  githubToken?: string;
  projectName?: string;
  environmentName?: string;
  username: string;
  requestId?: string; // Request ID for tracing across services
}
