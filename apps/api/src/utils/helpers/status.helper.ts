import type { ContainerStatus } from '../../interfaces';

/**
 * Helper to determine service status based on database state and container state
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function determineServiceStatus(service: any, containers: ContainerStatus[]): string {
  // If the service itself is marked as DEPLOYING in the database, respect that first
  if (service.status === 'DEPLOYING') {
    return 'DEPLOYING';
  }

  const serviceContainers = containers.filter(
    (c) =>
      c.labels['helvetia.serviceId'] === service.id ||
      (service.type === 'COMPOSE' && c.labels['com.docker.compose.project'] === service.name),
  );
  const latestDeployment = service.deployments[0];

  // If there's an active deployment in progress, it's DEPLOYING
  if (latestDeployment && ['QUEUED', 'BUILDING'].includes(latestDeployment.status)) {
    return 'DEPLOYING';
  }

  if (serviceContainers.length > 0) {
    if (serviceContainers.some((c) => c.state === 'running')) {
      return 'RUNNING';
    }
    if (serviceContainers.some((c) => c.state === 'restarting')) {
      return 'CRASHING';
    }
    if (serviceContainers.every((c) => ['exited', 'dead', 'created'].includes(c.state))) {
      return 'STOPPED';
    }
    return serviceContainers[0].state.toUpperCase();
  }

  if (latestDeployment) {
    if (latestDeployment.status === 'FAILED') {
      return 'FAILED';
    }
    if (latestDeployment.status === 'SUCCESS') {
      return 'STOPPED';
    }
  }

  return 'IDLE';
}
