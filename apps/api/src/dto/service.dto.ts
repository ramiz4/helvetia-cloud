/**
 * Data Transfer Objects for Service operations
 */

/**
 * DTO for creating a service
 */
export interface CreateServiceDto {
  name: string;
  repoUrl?: string | null;
  branch?: string;
  buildCommand?: string | null;
  startCommand?: string | null;
  port?: number;
  envVars?: Record<string, string>;
  customDomain?: string | null;
  type?: string;
  staticOutputDir?: string | null;
  userId: string;
}

/**
 * DTO for updating a service
 */
export interface UpdateServiceDto {
  name?: string;
  repoUrl?: string | null;
  branch?: string;
  buildCommand?: string | null;
  startCommand?: string | null;
  port?: number;
  envVars?: Record<string, string>;
  customDomain?: string | null;
  type?: string;
  staticOutputDir?: string | null;
  deletedAt?: Date | null;
  deleteProtected?: boolean;
  status?: string;
}

/**
 * DTO for service with metrics
 */
export interface ServiceWithMetricsDto {
  id: string;
  name: string;
  repoUrl: string | null;
  branch: string;
  buildCommand: string | null;
  startCommand: string | null;
  port: number;
  status: string;
  userId: string;
  envVars: unknown;
  createdAt: Date;
  updatedAt: Date;
  customDomain: string | null;
  staticOutputDir: string | null;
  type: string;
  isPreview: boolean;
  prNumber: number | null;
  deleteProtected: boolean;
  metrics?: {
    cpu: number;
    memory: number;
    memoryLimit: number;
    status: string;
  };
}
