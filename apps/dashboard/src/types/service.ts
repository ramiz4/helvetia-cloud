export interface Service {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  status: string;
  type: string;
  staticOutputDir?: string;
  envVars?: Record<string, string>;
  customDomain?: string;
  isPreview?: boolean;
  prNumber?: number;
  metrics?: { cpu: number; memory: number; memoryLimit: number; status?: string };
  deployments: { id: string; status: string; createdAt: string }[];
}

export interface UpdateServiceData {
  name?: string;
  repoUrl?: string;
  branch?: string;
  buildCommand?: string;
  startCommand?: string;
  port?: number;
  type?: string;
  staticOutputDir?: string;
  envVars?: Record<string, string>;
  customDomain?: string;
}
