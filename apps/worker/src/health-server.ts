import { Queue } from 'bullmq';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import IORedis from 'ioredis';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const WORKER_HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '3002', 10);

// Track worker start time for uptime calculation
const workerStartTime = Date.now();

// Redis connection for health checks
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  lazyConnect: true, // Don't connect immediately
});

// Queue for checking stats
const deploymentQueue = new Queue('deployments', {
  connection: redisConnection,
});

// Create Fastify instance for health checks
export const healthServer = Fastify({
  logger: false, // Disable logging for health checks to reduce noise
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
healthServer.get('/health', async (_request, reply) => {
  try {
    // Check Redis connection status
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
      if (isRedisConnected) {
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
 * Start the health check server
 */
export async function startHealthServer() {
  try {
    // Connect to Redis if not already connecting/connected
    if (redisConnection.status === 'wait') {
      await redisConnection.connect();
      console.log('Redis connected for health checks');
    }

    await healthServer.listen({ port: WORKER_HEALTH_PORT, host: '0.0.0.0' });
    console.log(`Worker health check server listening on port ${WORKER_HEALTH_PORT}`);
  } catch (err) {
    console.error('Failed to start health check server:', err);
    process.exit(1);
  }
}

/**
 * Stop the health check server gracefully
 */
export async function stopHealthServer() {
  try {
    await healthServer.close();
    await redisConnection.quit();
    console.log('Health check server stopped');
  } catch (err) {
    console.error('Error stopping health check server:', err);
  }
}
