import type { CreateServiceDto, UpdateServiceDto } from '../dto';
import type { Deployment, Service } from './index';

/**
 * Interface for ServiceManagementService
 * Handles business logic for service CRUD operations
 */
export interface IServiceManagementService {
  /**
   * Get all services for a user
   */
  getUserServices(userId: string): Promise<Service[]>;

  /**
   * Get a single service by ID
   */
  getServiceById(serviceId: string, userId: string): Promise<Service>;

  /**
   * Create a new service or update existing one
   */
  createOrUpdateService(dto: CreateServiceDto): Promise<Service>;

  /**
   * Update an existing service
   */
  updateService(serviceId: string, userId: string, dto: UpdateServiceDto): Promise<Service>;

  /**
   * Soft delete a service
   */
  softDeleteService(serviceId: string, userId: string): Promise<void>;

  /**
   * Recover a soft-deleted service
   */
  recoverService(serviceId: string, userId: string): Promise<Service>;

  /**
   * Toggle delete protection for a service
   */
  toggleDeleteProtection(serviceId: string, userId: string, protected_: boolean): Promise<Service>;

  /**
   * Hard delete a service
   */
  hardDeleteService(serviceId: string, userId?: string): Promise<void>;

  /**
   * Check if a service name is available
   */
  isServiceNameAvailable(name: string, userId: string): Promise<boolean>;

  /**
   * Get all deployments for a service
   */
  getServiceDeployments(
    serviceId: string,
    userId: string,
    options?: { take?: number; skip?: number },
  ): Promise<Deployment[]>;
}
