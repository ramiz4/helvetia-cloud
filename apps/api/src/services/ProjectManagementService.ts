import { ConflictError, ForbiddenError, NotFoundError } from 'shared';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens.js';
import {
  Environment,
  IOrganizationRepository,
  IProjectManagementService,
  IProjectRepository,
  Project,
} from '../interfaces/index.js';

@injectable()
export class ProjectManagementService implements IProjectManagementService {
  constructor(
    @inject(Symbol.for('IProjectRepository'))
    private projectRepository: IProjectRepository,
    @inject(TOKENS.OrganizationRepository)
    private organizationRepository: IOrganizationRepository,
  ) {}

  async getUserProjects(userId: string): Promise<Project[]> {
    return this.projectRepository.findByUserId(userId);
  }

  // TODO: The getOrganizationProjects method lacks test coverage. Tests should verify that organization members can access projects, non-members are rejected with ForbiddenError, and projects are correctly retrieved by organizationId.
  async getOrganizationProjects(organizationId: string, userId: string): Promise<Project[]> {
    const member = await this.organizationRepository.getMember(organizationId, userId);
    if (!member) {
      throw new ForbiddenError('You are not a member of this organization');
    }
    return this.projectRepository.findByOrganizationId(organizationId);
  }

  async getProjectById(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.userId !== userId) {
      if (project.organizationId) {
        const member = await this.organizationRepository.getMember(project.organizationId, userId);
        if (!member) {
          throw new ForbiddenError('Unauthorized access to project');
        }
      } else {
        throw new ForbiddenError('Unauthorized access to project');
      }
    }

    return project;
  }

  async createProject(userId: string, name: string, organizationId?: string): Promise<Project> {
    const existing = await this.projectRepository.findByNameAndUserId(name, userId);
    if (existing) {
      throw new ConflictError('Project with this name already exists');
    }

    return this.projectRepository.create({ name, userId, organizationId });
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    await this.getProjectById(projectId, userId);

    // Check if project has services? Or just delete everything.
    // For now, let's just delete the project.
    await this.projectRepository.delete(projectId);
  }

  async createEnvironment(projectId: string, userId: string, name: string): Promise<Environment> {
    await this.getProjectById(projectId, userId);
    return this.projectRepository.createEnvironment({ projectId, name });
  }
}
