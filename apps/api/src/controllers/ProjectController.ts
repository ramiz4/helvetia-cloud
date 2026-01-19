import { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { IProjectManagementService } from '../interfaces/index.js';

@injectable()
export class ProjectController {
  constructor(
    @inject(Symbol.for('ProjectManagementService'))
    private projectService: IProjectManagementService,
  ) {}

  /**
   * List all projects for current user
   */
  async listProjects(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user.id;
    const { organizationId } = req.query as { organizationId?: string };

    if (organizationId) {
      const projects = await this.projectService.getOrganizationProjects(organizationId, userId);
      return reply.send(projects);
    }

    const projects = await this.projectService.getUserProjects(userId);
    return reply.send(projects);
  }

  /**
   * Get project details
   */
  async getProject(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const userId = req.user.id;
    const project = await this.projectService.getProjectById(req.params.id, userId);
    return reply.send(project);
  }

  /**
   * Create a new project
   */
  async createProject(
    req: FastifyRequest<{ Body: { name: string; organizationId?: string } }>,
    reply: FastifyReply,
  ) {
    const userId = req.user.id;
    const project = await this.projectService.createProject(
      userId,
      req.body.name,
      req.body.organizationId,
    );
    return reply.status(201).send(project);
  }

  /**
   * Delete a project
   */
  async deleteProject(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const userId = req.user.id;
    await this.projectService.deleteProject(req.params.id, userId);
    return reply.status(204).send();
  }

  /**
   * Create a new environment
   */
  async createEnvironment(
    req: FastifyRequest<{ Params: { id: string }; Body: { name: string } }>,
    reply: FastifyReply,
  ) {
    const userId = req.user.id;
    const env = await this.projectService.createEnvironment(req.params.id, userId, req.body.name);
    return reply.status(201).send(env);
  }
}
