import Docker from 'dockerode';

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  status: string;
  exitCode?: number;
  output?: string;
}

/**
 * HealthChecker provides utilities for checking container health
 */
export class HealthChecker {
  private docker: Docker;

  constructor(docker: Docker) {
    this.docker = docker;
  }

  /**
   * Check if a container is healthy
   * Returns true if container is running and (if health check defined) healthy
   */
  async isContainerHealthy(container: Docker.Container): Promise<HealthCheckResult> {
    try {
      const inspection = await container.inspect();

      // Container must be running
      if (!inspection.State.Running) {
        return {
          healthy: false,
          status: inspection.State.Status,
        };
      }

      // If no health check is defined, consider it healthy if running
      if (!inspection.State.Health) {
        return {
          healthy: true,
          status: 'running (no health check)',
        };
      }

      // Check health status
      const health = inspection.State.Health;
      return {
        healthy: health.Status === 'healthy',
        status: health.Status,
        exitCode: health.Log?.[health.Log.length - 1]?.ExitCode,
        output: health.Log?.[health.Log.length - 1]?.Output,
      };
    } catch (err) {
      return {
        healthy: false,
        status: 'error',
        output: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Wait for a container to become healthy
   * Returns true if healthy within timeout, false otherwise
   */
  async waitForHealthy(
    container: Docker.Container,
    options?: {
      timeout?: number; // milliseconds
      interval?: number; // milliseconds
    },
  ): Promise<boolean> {
    const timeout = options?.timeout || 30000; // 30 seconds default
    const interval = options?.interval || 1000; // 1 second default
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.isContainerHealthy(container);

      if (result.healthy) {
        return true;
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    return false;
  }

  /**
   * Check if all containers in a list are healthy
   */
  async areAllHealthy(containers: Docker.Container[]): Promise<boolean> {
    const results = await Promise.all(
      containers.map((container) => this.isContainerHealthy(container)),
    );

    return results.every((result) => result.healthy);
  }

  /**
   * Get detailed health status for multiple containers
   */
  async getHealthStatuses(containers: Docker.Container[]): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    await Promise.all(
      containers.map(async (container) => {
        const inspection = await container.inspect();
        const result = await this.isContainerHealthy(container);
        results.set(inspection.Id, result);
      }),
    );

    return results;
  }
}
