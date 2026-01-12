import type Docker from 'dockerode';
import Dockerode from 'dockerode';

/**
 * Get metrics for a service
 * Collects CPU and memory usage from all running containers for the service
 */
export async function getServiceMetrics(
  id: string,
  dockerInstance?: Docker,
  containerList?: Dockerode.ContainerInfo[],
  serviceInfo?: { name: string; type: string; status?: string },
) {
  const DockerLib = (await import('dockerode')).default;
  const docker = dockerInstance || new DockerLib();

  const containers = containerList || (await docker.listContainers({ all: true }));

  // Use either the explicit serviceInfo or try to find it from labels if missing
  // (though callers should provide it for accuracy with COMPOSE)
  const allServiceContainers = containers.filter(
    (c: Dockerode.ContainerInfo) =>
      c.Labels['helvetia.serviceId'] === id ||
      (serviceInfo?.type === 'COMPOSE' &&
        c.Labels['com.docker.compose.project'] === serviceInfo?.name),
  );

  // Determine aggregate status
  let status: string;
  if (serviceInfo?.status === 'DEPLOYING') {
    status = 'DEPLOYING';
  } else if (allServiceContainers.length > 0) {
    if (allServiceContainers.some((c: Dockerode.ContainerInfo) => c.State === 'running')) {
      status = 'RUNNING';
    } else if (
      allServiceContainers.some((c: Dockerode.ContainerInfo) =>
        ['restarting', 'created'].includes(c.State),
      )
    ) {
      status = 'DEPLOYING';
    } else if (
      allServiceContainers.some(
        (c: Dockerode.ContainerInfo) => c.State === 'exited' && c.Status.includes('Exited (0)'),
      )
    ) {
      // If it's a one-off task that finished successfully
      status = 'STOPPED';
    } else {
      status = 'FAILED';
    }
  } else {
    status = 'NOT_RUNNING';
  }

  const runningContainers = allServiceContainers.filter(
    (c: Dockerode.ContainerInfo) => c.State === 'running',
  );

  if (runningContainers.length === 0) {
    return { cpu: 0, memory: 0, memoryLimit: 0, status };
  }

  let totalCpu = 0;
  let totalMemory = 0;
  let totalMemoryLimit = 0;

  // Process all running containers and sum their metrics
  await Promise.all(
    runningContainers.map(async (containerInfo: Dockerode.ContainerInfo) => {
      try {
        const container = docker.getContainer(containerInfo.Id);
        const stats = await container.stats({ stream: false });

        if (stats.cpu_stats && stats.precpu_stats) {
          const cpuDelta =
            stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
          const systemDelta =
            stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
          const onlineCpus = stats.cpu_stats.online_cpus || 1;

          if (systemDelta > 0 && cpuDelta > 0) {
            totalCpu += (cpuDelta / systemDelta) * onlineCpus * 100.0;
          }
        }

        if (stats.memory_stats) {
          const usage = stats.memory_stats.usage - (stats.memory_stats.stats.cache || 0);
          totalMemory += usage / 1024 / 1024;
          totalMemoryLimit += stats.memory_stats.limit / 1024 / 1024;
        }
      } catch {
        // Ignore stats errors for individual containers
      }
    }),
  );

  return {
    cpu: parseFloat(totalCpu.toFixed(2)),
    memory: parseFloat(totalMemory.toFixed(2)),
    memoryLimit: parseFloat(totalMemoryLimit.toFixed(2)),
    status,
  };
}
