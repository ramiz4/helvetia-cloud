import type { DeploymentContext, DeploymentResult, IDeploymentStrategy } from '../interfaces';

// Type for Docker pull progress events
interface DockerPullProgressEvent {
  status?: string;
  id?: string;
  progress?: string;
  progressDetail?: {
    current?: number;
    total?: number;
  };
}

/**
 * Strategy for deploying managed database services
 * Handles POSTGRES, REDIS, and MYSQL deployments
 */
export class DatabaseDeploymentStrategy implements IDeploymentStrategy {
  private readonly databaseImages: Record<string, string> = {
    POSTGRES: 'postgres:15-alpine',
    REDIS: 'redis:7-alpine',
    MYSQL: 'mysql:8',
  };

  canHandle(type: string): boolean {
    return ['POSTGRES', 'REDIS', 'MYSQL'].includes(type);
  }

  async deploy(context: DeploymentContext): Promise<DeploymentResult> {
    const { docker, type } = context;

    const imageTag = this.databaseImages[type];
    if (!imageTag) {
      throw new Error(`Unknown database type: ${type}`);
    }

    console.log(`Managed service ${type} detected. Using image ${imageTag}. Pulling image...`);

    // Pull the database image
    try {
      const stream = await docker.pull(imageTag);
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(
          stream,
          (err: Error | null, res: DockerPullProgressEvent[]) => {
            if (err) reject(err);
            else resolve(res);
          },
        );
      });
      console.log(`Successfully pulled ${imageTag}`);
    } catch (pullError) {
      console.error(`Failed to pull image ${imageTag}:`, pullError);
      throw new Error(`Failed to pull database image: ${pullError}`);
    }

    const buildLogs = `Managed service deployment. Pulled official image ${imageTag}.`;

    return {
      imageTag,
      buildLogs,
      success: true,
    };
  }
}
