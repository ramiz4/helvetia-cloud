import { Service } from './IServiceRepository';

export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  environments?: Environment[];
}

export interface Environment {
  id: string;
  name: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  services?: Service[];
  project?: Project;
}

export interface ProjectCreateInput {
  name: string;
  userId: string;
}

export interface EnvironmentCreateInput {
  name: string;
  projectId: string;
}

export interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  findByUserId(userId: string): Promise<Project[]>;
  findByNameAndUserId(name: string, userId: string): Promise<Project | null>;
  create(data: ProjectCreateInput): Promise<Project>;
  delete(id: string): Promise<void>;

  // Environment operations within project
  findEnvironmentById(id: string): Promise<Environment | null>;
  createEnvironment(data: EnvironmentCreateInput): Promise<Environment>;
  findEnvironmentsByProjectId(projectId: string): Promise<Environment[]>;
}
