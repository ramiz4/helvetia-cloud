export type ServiceStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'DEPLOYING'
  | 'FAILED'
  | 'NOT_RUNNING'
  | 'STOPPED'
  | 'CRASHING';
export type ServiceType = 'DOCKER' | 'STATIC' | 'COMPOSE';

export interface ServiceMetric {
  cpu: number;
  memory: number;
  memoryLimit: number;
  status?: string;
}

export interface ServiceDeployment {
  id: string;
  status: string;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  status: ServiceStatus;
  type: ServiceType;
  environmentId?: string;
  projectName?: string; // Populated from Environment -> Project
  environmentName?: string;
  username?: string;
  staticOutputDir?: string;
  envVars?: Record<string, string>;
  volumes?: string[];
  customDomain?: string;
  isPreview?: boolean;
  prNumber?: number;
  metrics?: ServiceMetric;
  deployments: ServiceDeployment[];
  containerName?: string;
  createdAt: string;
}

export interface UpdateServiceData {
  name?: string;
  repoUrl?: string;
  branch?: string;
  buildCommand?: string;
  startCommand?: string;
  port?: number;
  type?: ServiceType;
  staticOutputDir?: string;
  envVars?: Record<string, string>;
  volumes?: string[];
  customDomain?: string;
}
