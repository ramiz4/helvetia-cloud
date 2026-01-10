/**
 * Deployment model type (matches Prisma schema)
 */
export interface Deployment {
  id: string;
  serviceId: string;
  status: string;
  logs: string | null;
  commitHash: string | null;
  imageTag: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Deployment create input
 */
export interface DeploymentCreateInput {
  id?: string;
  serviceId: string;
  status?: string;
  logs?: string | null;
  commitHash?: string | null;
  imageTag?: string | null;
}

/**
 * Deployment update input
 */
export interface DeploymentUpdateInput {
  status?: string;
  logs?: string | null;
  commitHash?: string | null;
  imageTag?: string | null;
}

/**
 * Interface for deployment repository operations
 */
export interface IDeploymentRepository {
  /**
   * Find a deployment by ID
   */
  findById(id: string): Promise<Deployment | null>;

  /**
   * Find deployments by service ID
   */
  findByServiceId(
    serviceId: string,
    options?: { take?: number; skip?: number },
  ): Promise<Deployment[]>;

  /**
   * Create a new deployment
   */
  create(data: DeploymentCreateInput): Promise<Deployment>;

  /**
   * Update a deployment
   */
  update(id: string, data: DeploymentUpdateInput): Promise<Deployment>;

  /**
   * Delete a deployment
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all deployments for a service
   */
  deleteByServiceId(serviceId: string): Promise<void>;

  /**
   * Count deployments by service ID
   */
  countByServiceId(serviceId: string): Promise<number>;
}
