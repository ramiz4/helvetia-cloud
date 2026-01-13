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
  volumes?: string[];
  userId: string;
  environmentId?: string | null;
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
  volumes?: string[];
  deletedAt?: Date | null;
  deleteProtected?: boolean;
  status?: string;
  environmentId?: string | null;
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
  environmentId: string | null;
  envVars: unknown;
  createdAt: Date;
  updatedAt: Date;
  customDomain: string | null;
  staticOutputDir: string | null;
  type: string;
  volumes: string[] | null;
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
