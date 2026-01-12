import { inject, injectable } from 'tsyringe';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import { Environment, IProjectRepository, Project } from '../interfaces';

@injectable()
export class ProjectManagementService {
  constructor(
    @inject(Symbol.for('IProjectRepository'))
    private projectRepository: IProjectRepository,
  ) {}

  async getUserProjects(userId: string): Promise<Project[]> {
    return this.projectRepository.findByUserId(userId);
  }

  async getProjectById(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.userId !== userId) {
      throw new ForbiddenError('Unauthorized access to project');
    }

    return project;
  }

  async createProject(userId: string, name: string): Promise<Project> {
    const existing = await this.projectRepository.findByNameAndUserId(name, userId);
    if (existing) {
      throw new ConflictError('Project with this name already exists');
    }

    return this.projectRepository.create({ name, userId });
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
