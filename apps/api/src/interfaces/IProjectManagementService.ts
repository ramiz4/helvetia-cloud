import type { Environment, Project } from './IProjectRepository';

/**
 * Interface for ProjectManagementService
 * Handles business logic for project and environment management
 */
export interface IProjectManagementService {
  /**
   * Get all projects for a user
   */
  getUserProjects(userId: string): Promise<Project[]>;
  getOrganizationProjects(organizationId: string, userId: string): Promise<Project[]>;

  /**
   * Get a single project by ID
   */
  getProjectById(projectId: string, userId: string): Promise<Project>;

  /**
   * Create a new project
   */
  createProject(userId: string, name: string, organizationId?: string): Promise<Project>;

  /**
   * Delete a project
   */
  deleteProject(projectId: string, userId: string): Promise<void>;

  /**
   * Create a new environment within a project
   */
  createEnvironment(projectId: string, userId: string, name: string): Promise<Environment>;
}
