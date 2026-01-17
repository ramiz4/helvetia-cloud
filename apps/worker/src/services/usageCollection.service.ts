import { PrismaClient, UsageMetric } from 'database';
import Docker from 'dockerode';
import IORedis from 'ioredis';
import { logger } from 'shared';

/**
 * Container usage metrics
 */
interface ContainerMetrics {
  containerId: string;
  serviceId: string;
  cpuPercent: number;
  memoryMB: number;
  memoryLimitMB: number;
  networkRxBytes: number;
  networkTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
}

/**
 * Aggregated service usage for a collection period
 */
interface ServiceUsage {
  serviceId: string;
  computeHours: number;
  memoryGBHours: number;
  bandwidthGB: number;
  storageGB: number;
}

/**
 * Previous container metrics stored for delta calculation
 */
interface PreviousMetrics {
  networkRxBytes: number;
  networkTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
  timestamp: number;
}

/**
 * UsageCollectionService
 * Collects resource usage metrics from running containers
 */
export class UsageCollectionService {
  private redis: IORedis;

  constructor(
    private docker: Docker,
    private prisma: PrismaClient,
    redisUrl?: string,
  ) {
    this.redis = new IORedis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }

  /**
   * Collect metrics from a single container
   */
  private async collectContainerMetrics(
    containerId: string,
    serviceId: string,
  ): Promise<ContainerMetrics | null> {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });

      // Calculate CPU percentage
      let cpuPercent = 0;
      if (stats.cpu_stats && stats.precpu_stats) {
        const cpuDelta =
          stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const onlineCpus = stats.cpu_stats.online_cpus || 1;

        if (systemDelta > 0 && cpuDelta > 0) {
          cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100.0;
        }
      }

      // Calculate memory usage (excluding cache)
      let memoryMB = 0;
      let memoryLimitMB = 0;
      if (stats.memory_stats) {
        const usage = stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0);
        memoryMB = usage / 1024 / 1024;
        memoryLimitMB = stats.memory_stats.limit / 1024 / 1024;
      }

      // Calculate network I/O
      let networkRxBytes = 0;
      let networkTxBytes = 0;
      if (stats.networks) {
        for (const network of Object.values(stats.networks)) {
          networkRxBytes += network.rx_bytes || 0;
          networkTxBytes += network.tx_bytes || 0;
        }
      }

      // Calculate block I/O (for storage)
      let blockReadBytes = 0;
      let blockWriteBytes = 0;
      if (stats.blkio_stats && stats.blkio_stats.io_service_bytes_recursive) {
        for (const entry of stats.blkio_stats.io_service_bytes_recursive) {
          if (entry.op === 'read' || entry.op === 'Read') {
            blockReadBytes += entry.value || 0;
          } else if (entry.op === 'write' || entry.op === 'Write') {
            blockWriteBytes += entry.value || 0;
          }
        }
      }

      return {
        containerId,
        serviceId,
        cpuPercent: parseFloat(cpuPercent.toFixed(2)),
        memoryMB: parseFloat(memoryMB.toFixed(2)),
        memoryLimitMB: parseFloat(memoryLimitMB.toFixed(2)),
        networkRxBytes,
        networkTxBytes,
        blockReadBytes,
        blockWriteBytes,
      };
    } catch (error) {
      logger.warn(
        { err: error, containerId, serviceId },
        'Failed to collect metrics for container',
      );
      return null;
    }
  }

  /**
   * Collect metrics from all running containers
   */
  async collectAllMetrics(): Promise<ContainerMetrics[]> {
    try {
      const containers = await this.docker.listContainers({
        filters: { status: ['running'] },
      });

      const metrics: ContainerMetrics[] = [];

      for (const containerInfo of containers) {
        const serviceId = containerInfo.Labels['helvetia.serviceId'];

        // Skip containers that don't belong to a service
        if (!serviceId) {
          continue;
        }

        const metric = await this.collectContainerMetrics(containerInfo.Id, serviceId);
        if (metric) {
          metrics.push(metric);
        }
      }

      return metrics;
    } catch (error) {
      logger.error({ err: error }, 'Failed to collect container metrics');
      throw error;
    }
  }

  /**
   * Get previous metrics for a container from Redis
   */
  private async getPreviousMetrics(containerId: string): Promise<PreviousMetrics | null> {
    try {
      const key = `usage:container:${containerId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn({ err: error, containerId }, 'Failed to get previous metrics from Redis');
      return null;
    }
  }

  /**
   * Store current metrics as previous for next collection
   */
  private async storePreviousMetrics(
    containerId: string,
    metrics: ContainerMetrics,
  ): Promise<void> {
    try {
      const key = `usage:container:${containerId}`;
      const data: PreviousMetrics = {
        networkRxBytes: metrics.networkRxBytes,
        networkTxBytes: metrics.networkTxBytes,
        blockReadBytes: metrics.blockReadBytes,
        blockWriteBytes: metrics.blockWriteBytes,
        timestamp: Date.now(),
      };
      // Store with 24 hour expiry to auto-cleanup stopped containers
      await this.redis.setex(key, 86400, JSON.stringify(data));
    } catch (error) {
      logger.warn({ err: error, containerId }, 'Failed to store previous metrics to Redis');
    }
  }

  /**
   * Calculate usage for a collection interval
   * @param metrics Container metrics collected
   * @param intervalMinutes Collection interval in minutes
   */
  async calculateUsage(
    metrics: ContainerMetrics[],
    intervalMinutes: number,
  ): Promise<ServiceUsage[]> {
    const usageMap = new Map<string, ServiceUsage>();

    for (const metric of metrics) {
      const existing = usageMap.get(metric.serviceId);

      // Calculate compute hours (container was running for the interval)
      const computeHours = intervalMinutes / 60;

      // Calculate memory GB-hours (memory usage * time)
      const memoryGBHours = (metric.memoryMB / 1024) * (intervalMinutes / 60);

      // Get previous metrics to calculate deltas for cumulative values
      const previous = await this.getPreviousMetrics(metric.containerId);

      // Calculate bandwidth GB (network I/O delta, convert bytes to GB)
      let bandwidthGB = 0;
      if (previous) {
        const rxDelta = Math.max(0, metric.networkRxBytes - previous.networkRxBytes);
        const txDelta = Math.max(0, metric.networkTxBytes - previous.networkTxBytes);
        bandwidthGB = (rxDelta + txDelta) / 1024 / 1024 / 1024;
      }
      // If no previous data, skip bandwidth for this collection (first collection)

      // Calculate storage GB (block I/O delta as a proxy for storage)
      let storageGB = 0;
      if (previous) {
        const readDelta = Math.max(0, metric.blockReadBytes - previous.blockReadBytes);
        const writeDelta = Math.max(0, metric.blockWriteBytes - previous.blockWriteBytes);
        storageGB = (readDelta + writeDelta) / 1024 / 1024 / 1024;
      }
      // If no previous data, skip storage for this collection (first collection)

      // Store current metrics as previous for next collection
      await this.storePreviousMetrics(metric.containerId, metric);

      if (existing) {
        existing.computeHours += computeHours;
        existing.memoryGBHours += memoryGBHours;
        existing.bandwidthGB += bandwidthGB;
        existing.storageGB += storageGB;
      } else {
        usageMap.set(metric.serviceId, {
          serviceId: metric.serviceId,
          computeHours,
          memoryGBHours,
          bandwidthGB,
          storageGB,
        });
      }
    }

    return Array.from(usageMap.values());
  }

  /**
   * Record usage to database
   */
  async recordUsage(usage: ServiceUsage[], periodStart: Date, periodEnd: Date): Promise<void> {
    const records = [];

    for (const serviceUsage of usage) {
      // Record compute hours
      if (serviceUsage.computeHours > 0) {
        records.push({
          serviceId: serviceUsage.serviceId,
          metric: UsageMetric.COMPUTE_HOURS,
          quantity: serviceUsage.computeHours,
          timestamp: new Date(),
          periodStart,
          periodEnd,
        });
      }

      // Record memory GB-hours
      if (serviceUsage.memoryGBHours > 0) {
        records.push({
          serviceId: serviceUsage.serviceId,
          metric: UsageMetric.MEMORY_GB_HOURS,
          quantity: serviceUsage.memoryGBHours,
          timestamp: new Date(),
          periodStart,
          periodEnd,
        });
      }

      // Record bandwidth GB
      if (serviceUsage.bandwidthGB > 0) {
        records.push({
          serviceId: serviceUsage.serviceId,
          metric: UsageMetric.BANDWIDTH_GB,
          quantity: serviceUsage.bandwidthGB,
          timestamp: new Date(),
          periodStart,
          periodEnd,
        });
      }

      // Record storage GB
      if (serviceUsage.storageGB > 0) {
        records.push({
          serviceId: serviceUsage.serviceId,
          metric: UsageMetric.STORAGE_GB,
          quantity: serviceUsage.storageGB,
          timestamp: new Date(),
          periodStart,
          periodEnd,
        });
      }
    }

    if (records.length > 0) {
      await this.prisma.usageRecord.createMany({
        data: records,
      });

      logger.info(
        { count: records.length, services: usage.length },
        'Recorded usage for collection period',
      );
    }
  }

  /**
   * Collect and record usage for the current period
   */
  async collectAndRecord(intervalMinutes: number): Promise<{
    servicesProcessed: number;
    recordsCreated: number;
    usage: ServiceUsage[];
    periodStart: Date;
    periodEnd: Date;
  }> {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - intervalMinutes * 60 * 1000);

    logger.info({ periodStart, periodEnd, intervalMinutes }, 'Starting usage collection');

    // Collect metrics from all containers
    const metrics = await this.collectAllMetrics();

    if (metrics.length === 0) {
      logger.info('No running containers found for usage collection');
      return { servicesProcessed: 0, recordsCreated: 0, usage: [], periodStart, periodEnd };
    }

    // Calculate usage with delta tracking
    const usage = await this.calculateUsage(metrics, intervalMinutes);

    // Record to database
    await this.recordUsage(usage, periodStart, periodEnd);

    const recordsCreated = usage.reduce((sum, u) => {
      let count = 0;
      if (u.computeHours > 0) count++;
      if (u.memoryGBHours > 0) count++;
      if (u.bandwidthGB > 0) count++;
      if (u.storageGB > 0) count++;
      return sum + count;
    }, 0);

    return {
      servicesProcessed: usage.length,
      recordsCreated,
      usage,
      periodStart,
      periodEnd,
    };
  }

  /**
   * Cleanup method to close Redis connection
   */
  async cleanup(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      logger.warn({ err: error }, 'Failed to cleanup Redis connection');
    }
  }
}
