export type ImportType = 'github' | 'manual' | 'database' | 'github-image';
export type ServiceType = 'docker' | 'static' | 'compose';
export type DbEngine = 'postgres' | 'redis' | 'mysql';

export interface ServiceFormData {
  projectId: string;
  environmentId: string;
  projectName?: string;
  importType: ImportType;
  repoUrl: string;
  branch: string;
  serviceType: ServiceType;
  dbEngine: DbEngine;
  buildCommand: string;
  startCommand: string;
  outputDirectory: string;
  port?: number;
  composeFile: string;
  mainService: string;
  envVars: { key: string; value: string }[];
}
