import { prisma } from 'database';
import Docker from 'dockerode';
import IORedis from 'ioredis';
import { CONTAINER_CPU_NANOCPUS, CONTAINER_MEMORY_LIMIT_BYTES } from '../config/constants';
import { withStatusLock } from './statusLock';

/**
 * Helper functions for container orchestration
 */

/**
 * Start a new container with the given configuration
 * Returns both the container and the postfix used in naming
 */
export async function startContainer(params: {
  docker: Docker;
  imageTag: string;
  serviceName: string;
  serviceId: string;
  type: string;
  port?: number;
  envVars?: Record<string, string>;
  customDomain?: string;
}): Promise<{ container: Docker.Container; postfix: string }> {
  const { docker, imageTag, serviceName, serviceId, type, port, envVars, customDomain } = params;

  console.log(`Starting container for ${serviceName}...`);

  // Generate a random postfix
  const postfix = Math.random().toString(36).substring(2, 8);
  const containerName = `${serviceName}-${postfix}`;

  const traefikRule = customDomain
    ? `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${serviceName}.localhost\`) || Host(\`${customDomain}\`)`
    : `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${serviceName}.localhost\`)`;

  const container = await docker.createContainer({
    Image: imageTag,
    name: containerName,
    Env: envVars ? Object.entries(envVars).map(([k, v]) => `${k}=${v}`) : [],
    Cmd:
      type === 'REDIS' && envVars?.REDIS_PASSWORD
        ? ['redis-server', '--requirepass', envVars.REDIS_PASSWORD]
        : undefined,
    Labels: {
      'helvetia.serviceId': serviceId,
      'helvetia.type': type || 'DOCKER',
      'traefik.enable': 'true',
      [`traefik.http.routers.${serviceName}.rule`]: traefikRule,
      [`traefik.http.routers.${serviceName}.entrypoints`]: 'web',
      [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: (
        port || (type === 'STATIC' ? 80 : 3000)
      ).toString(),
    },
    HostConfig: {
      NetworkMode: 'helvetia-net',
      RestartPolicy: { Name: 'always' },
      Memory: CONTAINER_MEMORY_LIMIT_BYTES,
      NanoCpus: CONTAINER_CPU_NANOCPUS,
      Binds:
        type === 'POSTGRES'
          ? [`helvetia-data-${serviceName}:/var/lib/postgresql/data`]
          : type === 'REDIS'
            ? [`helvetia-data-${serviceName}:/data`]
            : type === 'MYSQL'
              ? [`helvetia-data-${serviceName}:/var/lib/mysql`]
              : [],
      LogConfig: {
        Type: 'json-file',
        Config: {},
      },
    },
  });

  await container.start();
  console.log(`New container ${containerName} started.`);

  return { container, postfix };
}

/**
 * Clean up old containers for a service
 */
export async function cleanupOldContainers(params: {
  docker: Docker;
  serviceId: string;
  serviceName: string;
  currentPostfix: string;
}): Promise<void> {
  const { docker, serviceId, serviceName, currentPostfix } = params;

  console.log(`Cleaning up old containers for ${serviceName}...`);
  const currentContainers = await docker.listContainers({ all: true });
  const containersToRemove = currentContainers.filter(
    (c) =>
      c.Labels['helvetia.serviceId'] === serviceId &&
      c.Names.some((name) => !name.includes(currentPostfix)),
  );

  for (const old of containersToRemove) {
    const container = docker.getContainer(old.Id);
    await container.stop().catch(() => {});
    await container.remove().catch(() => {});
  }
}

/**
 * Rollback to old containers in case of failure
 */
export async function rollbackContainers(params: {
  docker: Docker;
  oldContainers: Docker.ContainerInfo[];
}): Promise<void> {
  const { docker, oldContainers } = params;

  if (oldContainers.length === 0) {
    console.log('No old containers to rollback to');
    return;
  }

  console.log(`Rolling back: restarting ${oldContainers.length} old container(s)...`);
  for (const oldContainerInfo of oldContainers) {
    try {
      const container = docker.getContainer(oldContainerInfo.Id);
      const containerState = await container.inspect();

      // Only restart if container was previously running
      if (containerState.State.Running) {
        console.log(`Container ${oldContainerInfo.Id} is still running, no action needed`);
      } else {
        console.log(`Restarting old container ${oldContainerInfo.Id}...`);
        await container.start();
        console.log(`Successfully restarted container ${oldContainerInfo.Id}`);
      }
    } catch (rollbackError) {
      console.error(`Failed to restart old container ${oldContainerInfo.Id}:`, rollbackError);
    }
  }
  console.log('Rollback attempt completed');
}

/**
 * Publish logs to Redis for real-time streaming
 */
export async function publishLogs(
  redisConnection: IORedis,
  deploymentId: string,
  logs: string,
): Promise<void> {
  await redisConnection.publish(`deployment-logs:${deploymentId}`, logs);
}

/**
 * Update deployment status in database
 */
export async function updateDeploymentStatus(params: {
  deploymentId: string;
  serviceId: string;
  status: 'BUILDING' | 'SUCCESS' | 'FAILED';
  logs?: string;
  imageTag?: string;
  oldContainers?: Docker.ContainerInfo[];
}): Promise<void> {
  const { deploymentId, serviceId, status, logs, imageTag, oldContainers } = params;

  if (status === 'SUCCESS') {
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status, imageTag, ...(logs ? { logs } : {}) },
    });

    await withStatusLock(serviceId, async () => {
      await prisma.service.update({
        where: { id: serviceId },
        data: { status: 'RUNNING' },
      });
    });
  } else if (status === 'FAILED') {
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status,
        logs,
      },
    });

    // Set service status based on rollback success
    const serviceStatus = oldContainers && oldContainers.length > 0 ? 'RUNNING' : 'FAILED';
    await withStatusLock(serviceId, async () => {
      await prisma.service.update({
        where: { id: serviceId },
        data: { status: serviceStatus },
      });
    });
  } else {
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status, ...(logs ? { logs } : {}) },
    });
  }
}
