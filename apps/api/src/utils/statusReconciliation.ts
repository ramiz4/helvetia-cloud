import { prisma } from 'database';
import Docker from 'dockerode';
import { withStatusLock } from '../utils/statusLock';

const docker = new Docker();

/**
 * Status reconciliation service
 * Periodically checks and corrects service status based on actual container state
 */
export class StatusReconciliationService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Starts the reconciliation service
   * @param intervalMs - How often to run reconciliation (default: 30000ms = 30s)
   */
  start(intervalMs = 30000): void {
    if (this.isRunning) {
      console.log('Status reconciliation service is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting status reconciliation service (interval: ${intervalMs}ms)`);

    // Run immediately
    this.reconcile().catch((error) => {
      console.error('Error during initial reconciliation:', error);
    });

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.reconcile().catch((error) => {
        console.error('Error during reconciliation:', error);
      });
    }, intervalMs);
  }

  /**
   * Stops the reconciliation service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Status reconciliation service stopped');
  }

  /**
   * Performs status reconciliation for all services
   */
  async reconcile(): Promise<void> {
    try {
      console.log('Starting status reconciliation...');

      // Fetch all services
      const services = await prisma.service.findMany({
        include: {
          deployments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      // Get all containers
      const containers = await docker.listContainers({ all: true });

      // Reconcile each service
      for (const service of services) {
        await this.reconcileService(service, containers);
      }

      console.log(`Reconciled ${services.length} services`);
    } catch (error) {
      console.error('Error during reconciliation:', error);
      throw error;
    }
  }

  /**
   * Reconciles a single service's status
   */
  private async reconcileService(service: any, containers: Docker.ContainerInfo[]): Promise<void> {
    try {
      // Use distributed lock to avoid conflicts
      await withStatusLock(
        service.id,
        async () => {
          const serviceContainers = containers.filter(
            (c) =>
              c.Labels['helvetia.serviceId'] === service.id ||
              (service.type === 'COMPOSE' &&
                c.Labels['com.docker.compose.project'] === service.name),
          );

          const latestDeployment = service.deployments[0];
          let expectedStatus: string;

          // Determine expected status based on actual state
          if (latestDeployment && ['QUEUED', 'BUILDING'].includes(latestDeployment.status)) {
            // Deployment is in progress
            expectedStatus = 'DEPLOYING';
          } else if (serviceContainers.length > 0) {
            // Check container states
            if (serviceContainers.some((c) => c.State === 'running')) {
              expectedStatus = 'RUNNING';
            } else if (serviceContainers.some((c) => c.State === 'restarting')) {
              expectedStatus = 'CRASHING';
            } else if (
              serviceContainers.every((c) => ['exited', 'dead', 'created'].includes(c.State))
            ) {
              expectedStatus = 'STOPPED';
            } else {
              expectedStatus = serviceContainers[0].State.toUpperCase();
            }
          } else if (latestDeployment) {
            // No containers but there are deployments
            if (latestDeployment.status === 'FAILED') {
              expectedStatus = 'FAILED';
            } else if (latestDeployment.status === 'SUCCESS') {
              expectedStatus = 'STOPPED';
            } else {
              expectedStatus = 'IDLE';
            }
          } else {
            // No containers and no deployments
            expectedStatus = 'IDLE';
          }

          // Update status if it differs
          if (service.status !== expectedStatus) {
            console.log(
              `Reconciling service ${service.name} (${service.id}): ${service.status} -> ${expectedStatus}`,
            );

            await prisma.service.update({
              where: { id: service.id },
              data: { status: expectedStatus },
            });
          }
        },
        5000, // 5 second lock TTL for reconciliation
      );
    } catch (error) {
      // Log but don't throw - continue with other services
      console.error(`Failed to reconcile service ${service.id}:`, error);
    }
  }
}

// Export singleton instance
export const statusReconciliationService = new StatusReconciliationService();
