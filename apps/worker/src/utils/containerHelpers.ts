import { prisma } from 'database';
import Docker from 'dockerode';
import IORedis from 'ioredis';
import { CONTAINER_CPU_NANOCPUS, CONTAINER_MEMORY_LIMIT_BYTES } from '../config/constants';
import { withStatusLock } from './statusLock';

type NetworkConfig = {
  Aliases: string[];
};

/**
 * Ensure a Docker network exists
 */
export async function ensureNetworkExists(
  docker: Docker,
  networkName: string,
  projectName?: string,
): Promise<void> {
  try {
    const networks = await docker.listNetworks({ filters: { name: [networkName] } });
    if (networks.length === 0) {
      console.log(`Creating network: ${networkName}`);
      await docker
        .createNetwork({
          Name: networkName,
          CheckDuplicate: true,
          Driver: 'bridge',
          Labels: { 'helvetia.managed': 'true', 'helvetia.projectName': projectName || 'global' },
        })
        .catch((err) => {
          // Ignore "already exists" errors during parallel startup
          if (!err.message.includes('already exists')) throw err;
        });
    }
  } catch (err) {
    console.error(`Failed to ensure network ${networkName} exists:`, err);
  }
}

/**
 * Get the standardized network name for a project and environment
 */
export function getNetworkName(params: {
  username?: string;
  projectName?: string;
  environmentName?: string;
}): string {
  const { username, projectName, environmentName } = params;
  if (!projectName) return 'helvetia-net';

  const sanitizedUsername = username ? username.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'global';

  if (environmentName) {
    return `helvetia-${sanitizedUsername}-${projectName}-${environmentName}`;
  }
  return `helvetia-${sanitizedUsername}-${projectName}`;
}

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
  projectName?: string;
  environmentName?: string;
  username?: string;
  onLog?: (log: string) => void;
}): Promise<{ container: Docker.Container; postfix: string }> {
  const {
    docker,
    imageTag,
    serviceName,
    serviceId,
    type,
    port,
    envVars,
    customDomain,
    projectName,
    environmentName,
    username,
    onLog,
  } = params;

  const startMsg = `==== Starting Container: ${serviceName} ====\n\n`;
  console.log(startMsg.trim());
  onLog?.(startMsg);

  // Default network and name
  const networkName = getNetworkName({ username, projectName, environmentName });
  const sanitizedUsername = username ? username.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'global';
  let baseName = `${sanitizedUsername}-${serviceName}`;

  // Use project-based naming for baseName if available
  if (projectName && environmentName) {
    baseName = `${sanitizedUsername}-${projectName}-${environmentName}-${serviceName}`;
  } else if (projectName) {
    baseName = `${sanitizedUsername}-${projectName}-${serviceName}`;
  }

  // Traefik needs a unique identifier for routers and services across all users/environments
  const traefikIdentifier = baseName;

  // Ensure networks exist
  await ensureNetworkExists(docker, 'helvetia-net');
  if (networkName !== 'helvetia-net') {
    await ensureNetworkExists(docker, networkName, projectName);
  }

  // Generate a short 4-char postfix (keeps names cleaner but unique for deployment)
  const postfix = Math.random().toString(36).substring(2, 6);
  const containerName = `${baseName}-${postfix}`;

  const hosts = [
    `${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}`,
    `${serviceName}.localhost`,
  ];

  if (customDomain) {
    hosts.push(customDomain);
  }

  if (projectName) {
    hosts.push(`${projectName}-${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}`);
    hosts.push(`${projectName}-${serviceName}.localhost`);
  }

  if (projectName && environmentName && username) {
    const sanitizedUsernameForHost = username.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const uHost = `${sanitizedUsernameForHost}.${projectName}.${environmentName}.${serviceName}`;
    hosts.push(`${uHost}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}`);
    hosts.push(`${uHost}.localhost`);
  }

  const traefikRule = hosts.map((h) => `Host(\`${h}\`)`).join(' || ');

  // Prepare network configuration
  const endpoints: Record<string, NetworkConfig> = {
    'helvetia-net': {
      Aliases: [serviceName],
    },
  };

  if (networkName !== 'helvetia-net') {
    endpoints[networkName] = {
      Aliases: [serviceName],
    };
  }

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
      'helvetia.projectName': projectName || 'global',
      'helvetia.environmentName': environmentName || 'global',
      'helvetia.type': type || 'DOCKER',
      'traefik.enable': 'true',
      'traefik.docker.network': 'helvetia-net',
      [`traefik.http.routers.${traefikIdentifier}.rule`]: traefikRule,
      [`traefik.http.routers.${traefikIdentifier}.entrypoints`]: 'web',
      [`traefik.http.services.${traefikIdentifier}.loadbalancer.server.port`]: (
        port || (type === 'STATIC' ? 80 : 3000)
      ).toString(),
    },
    NetworkingConfig: {
      EndpointsConfig: endpoints,
    },
    HostConfig: {
      RestartPolicy: { Name: 'always' },
      Memory: CONTAINER_MEMORY_LIMIT_BYTES,
      NanoCpus: CONTAINER_CPU_NANOCPUS,
      Binds:
        type === 'POSTGRES'
          ? [`${baseName}-data:/var/lib/postgresql/data`]
          : type === 'REDIS'
            ? [`${baseName}-data:/data`]
            : type === 'MYSQL'
              ? [`${baseName}-data:/var/lib/mysql`]
              : [],
      LogConfig: {
        Type: 'json-file',
        Config: {},
      },
    },
  });

  await container.start();
  console.log(`New container ${containerName} started on network ${networkName}.`);
  onLog?.(`🚀 Started container: ${containerName} on network: ${networkName}\n`);

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
