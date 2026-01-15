import { Queue } from 'bullmq';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import IORedis from 'ioredis';
import { env } from './config/env';
import { workerMetricsService } from './services/metrics.service';

// Track worker start time for uptime calculation
const workerStartTime = Date.now();

// Redis connection for health checks (lazy initialized)
let redisConnection: IORedis | null = null;
let deploymentQueue: Queue | null = null;

// Create Fastify instance for health checks
export const healthServer = Fastify({
  logger: false,
});

/**
 * Health Check Endpoint
 *
 * Returns comprehensive health information about the worker service:
 * - Overall health status (healthy/unhealthy)
 * - Queue statistics (waiting, active, completed, failed jobs)
 * - Redis connection status
 * - Worker uptime
 *
 * Response format:
 * {
 *   status: 'healthy' | 'unhealthy',
 *   uptime: number,           // Uptime in seconds
 *   redis: {
 *     connected: boolean,
 *     status: string
 *   },
 *   queue: {
 *     name: string,
 *     waiting: number,
 *     active: number,
 *     completed: number,
 *     failed: number
 *   },
 *   timestamp: string         // ISO 8601 timestamp
 * }
 */
healthServer.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Initialize Redis connection if needed
    if (!redisConnection) {
      redisConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      deploymentQueue = new Queue('deployments', { connection: redisConnection });
    }

    const redisStatus = redisConnection.status;
    const isRedisConnected = redisStatus === 'ready' || redisStatus === 'connect';

    // Get queue statistics
    let queueStats = {
      name: 'deployments',
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };

    try {
      // Only fetch queue stats if Redis is connected
      if (isRedisConnected && deploymentQueue) {
        const [waiting, active, completed, failed] = await Promise.all([
          deploymentQueue.getWaitingCount(),
          deploymentQueue.getActiveCount(),
          deploymentQueue.getCompletedCount(),
          deploymentQueue.getFailedCount(),
        ]);

        queueStats = {
          name: 'deployments',
          waiting,
          active,
          completed,
          failed,
        };
      }
    } catch (queueError) {
      console.error('Failed to fetch queue statistics:', queueError);
      // Continue with default stats
    }

    // Calculate uptime in seconds
    const uptimeSeconds = Math.floor((Date.now() - workerStartTime) / 1000);

    // Determine overall health status
    const isHealthy = isRedisConnected;

    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      uptime: uptimeSeconds,
      redis: {
        connected: isRedisConnected,
        status: redisStatus,
      },
      queue: queueStats,
      timestamp: new Date().toISOString(),
    };

    const statusCode = isHealthy ? 200 : 503;
    return reply.code(statusCode).send(healthData);
  } catch (error) {
    console.error('Health check error:', error);
    return reply.code(503).send({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Metrics Endpoint
 *
 * Returns Prometheus metrics for the worker service
 */
healthServer.get('/metrics', async (_request, reply) => {
  try {
    const metrics = await workerMetricsService.getMetrics();
    reply.type('text/plain; version=0.0.4; charset=utf-8');
    return metrics;
  } catch (error) {
    console.error('Failed to collect metrics:', error);
    return reply.status(500).send({ error: 'Failed to collect metrics' });
  }
});

/**
 * Metrics JSON Endpoint
 *
 * Returns metrics in JSON format for debugging
 */
healthServer.get('/metrics/json', async (_request, reply) => {
  try {
    const metrics = await workerMetricsService.getMetricsJSON();
    return metrics;
  } catch (error) {
    console.error('Failed to collect metrics:', error);
    return reply.status(500).send({ error: 'Failed to collect metrics' });
  }
});

/**
 * Start the health check server
 */
export async function startHealthServer() {
  try {
    await healthServer.listen({ port: env.WORKER_HEALTH_PORT, host: '0.0.0.0' });
    console.log(`Worker health check server listening on port ${env.WORKER_HEALTH_PORT}`);
  } catch (err) {
    console.error(`Failed to start health check server on port ${env.WORKER_HEALTH_PORT}:`, err);
    // If it's a port conflict, we should probably warn but NOT crash the entire worker
    // since the deployments are more important than the health check port in local dev.
    if (err instanceof Error && (err as any).code === 'EADDRINUSE') {
      console.warn(
        `⚠️  WARNING: Port ${env.WORKER_HEALTH_PORT} is already in use. Health check server will be disabled.`,
      );
      return;
    }
    process.exit(1);
  }
}

/**
 * Stop the health check server gracefully
 */
export async function stopHealthServer() {
  try {
    await healthServer.close();
    if (redisConnection) {
      await redisConnection.quit();
    }
    console.log('Health check server stopped');
  } catch (err) {
    console.error('Error stopping health check server:', err);
  }
}
