/**
 * Service model type (matches Prisma schema)
 */
export interface Service {
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
  isPreview: boolean;
  prNumber: number | null;
  deletedAt: Date | null;
  deleteProtected: boolean;
}

/**
 * Service create input
 */
export interface ServiceCreateInput {
  id?: string;
  name: string;
  repoUrl?: string | null;
  branch?: string;
  buildCommand?: string | null;
  startCommand?: string | null;
  port?: number;
  status?: string;
  userId: string;
  environmentId?: string | null;
  envVars?: unknown;
  customDomain?: string | null;
  staticOutputDir?: string | null;
  type?: string;
  isPreview?: boolean;
  prNumber?: number | null;
  deleteProtected?: boolean;
}

/**
 * Service update input
 */
export interface ServiceUpdateInput {
  name?: string;
  repoUrl?: string | null;
  branch?: string;
  buildCommand?: string | null;
  startCommand?: string | null;
  port?: number;
  status?: string;
  environmentId?: string | null;
  envVars?: unknown;
  customDomain?: string | null;
  staticOutputDir?: string | null;
  type?: string;
  isPreview?: boolean;
  prNumber?: number | null;
  deletedAt?: Date | null;
  deleteProtected?: boolean;
}

/**
 * Interface for service repository operations
 */
export interface IServiceRepository {
  /**
   * Find a service by ID
   */
  findById(id: string): Promise<Service | null>;

  /**
   * Find services by user ID
   */
  findByUserId(userId: string, options?: { take?: number; skip?: number }): Promise<Service[]>;

  /**
   * Find a service by name and user ID
   */
  findByNameAndUserId(name: string, userId: string): Promise<Service | null>;

  /**
   * Find a service by name and user ID including soft-deleted ones
   */
  findByNameAll(name: string, userId: string): Promise<Service | null>;

  /**
   * Find a service by name and environment ID including soft-deleted ones
   */
  findByNameAndEnvironment(
    name: string,
    environmentId: string,
    userId: string,
  ): Promise<Service | null>;

  /**
   * Create a new service
   */
  create(data: ServiceCreateInput): Promise<Service>;

  /**
   * Update a service
   */
  update(id: string, data: ServiceUpdateInput): Promise<Service>;

  /**
   * Delete a service
   */
  delete(id: string): Promise<void>;

  /**
   * Find services with specific status
   */
  findByStatus(status: string, options?: { take?: number; skip?: number }): Promise<Service[]>;

  /**
   * Find all services (for reconciliation)
   */
  findAll(options?: { take?: number; skip?: number }): Promise<Service[]>;

  /**
   * Find services by environment ID
   */
  findByEnvironmentId(environmentId: string): Promise<Service[]>;
}
