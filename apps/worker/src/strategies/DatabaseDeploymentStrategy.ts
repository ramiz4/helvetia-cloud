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
    MONGODB: 'mongo:6',
    MARIADB: 'mariadb:11',
    CASSANDRA: 'cassandra:4',
    ELASTICSEARCH: 'elasticsearch:8.11.1',
    COUCHDB: 'couchdb:3',
    RABBITMQ: 'rabbitmq:3-management',
    NEO4J: 'neo4j:5',
    ZOOKEEPER: 'zookeeper:3.9',
    CLICKHOUSE: 'clickhouse/clickhouse-server:23',
    INFLUXDB: 'influxdb:2',
  };

  canHandle(type: string): boolean {
    return Object.keys(this.databaseImages).includes(type);
  }

  async deploy(context: DeploymentContext): Promise<DeploymentResult> {
    const { docker, type } = context;

    const imageTag = this.databaseImages[type];
    if (!imageTag) {
      throw new Error(`Unknown database type: ${type}`);
    }

    const startMsg = `==== Managed database service ${type} detected. Using image ${imageTag} ====\n`;
    console.log(startMsg.trim());
    context.onLog?.(startMsg);

    let buildLogs = startMsg;

    // Pull the database image
    try {
      const stream = await docker.pull(imageTag);
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(
          stream,
          (err: Error | null, res: unknown) => {
            if (err) reject(err);
            else resolve(res);
          },
          (event: DockerPullProgressEvent) => {
            const status = event.status || '';
            const progress = event.progress || '';
            const id = event.id ? `[${event.id}] ` : '';
            const logLine = `${id}${status} ${progress}\n`;
            buildLogs += logLine;
            context.onLog?.(logLine);
          },
        );
      });
      const successMsg = `Successfully pulled ${imageTag}\n`;
      console.log(successMsg.trim());
      context.onLog?.(successMsg);
      buildLogs += successMsg;
    } catch (pullError) {
      const errorMsg = `Failed to pull image ${imageTag}: ${pullError}\n`;
      console.error(errorMsg.trim());
      context.onLog?.(errorMsg);
      throw new Error(`Failed to pull database image: ${pullError}`);
    }

    return {
      imageTag,
      buildLogs,
      success: true,
    };
  }
}
