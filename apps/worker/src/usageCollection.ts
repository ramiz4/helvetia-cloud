import { Queue, Worker } from 'bullmq';
import { prisma } from 'database';
import Docker from 'dockerode';
import IORedis from 'ioredis';
import path from 'path';
import { logger } from 'shared';
import { UsageCollectionService } from './services/usageCollection.service';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Configuration
const COLLECTION_INTERVAL_MINUTES = parseInt(
  process.env.USAGE_COLLECTION_INTERVAL_MINUTES || '10',
  10,
);

// Redis connection
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create usage collection queue
export const usageCollectionQueue = new Queue('usage-collection', {
  connection: redisConnection,
});

// Create usage collection worker
export const usageCollectionWorker = new Worker(
  'usage-collection',
  async (_job) => {
    logger.info('Running scheduled usage collection job');

    const docker = new Docker();
    const usageCollectionService = new UsageCollectionService(docker, prisma);

    try {
      const result = await usageCollectionService.collectAndRecord(COLLECTION_INTERVAL_MINUTES);

      logger.info(
        {
          servicesProcessed: result.servicesProcessed,
          recordsCreated: result.recordsCreated,
          intervalMinutes: COLLECTION_INTERVAL_MINUTES,
        },
        'Usage collection completed successfully',
      );

      return result;
    } catch (error) {
      logger.error({ err: error }, 'Usage collection failed');
      throw error;
    }
  },
  {
    connection: redisConnection,
    // Retry configuration
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds initial delay
    },
  },
);

// Error handling
usageCollectionWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(
      { jobId: job.id, err },
      `Usage collection job ${job.id} failed after ${job.attemptsMade} attempts`,
    );
  }
});

usageCollectionWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, `Usage collection job ${job.id} completed successfully`);
});

/**
 * Schedule the usage collection job to run periodically
 */
export async function scheduleUsageCollection() {
  // Remove any existing jobs with the same name to avoid duplicates
  const repeatableJobs = await usageCollectionQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'periodic-usage-collection') {
      await usageCollectionQueue.removeRepeatableByKey(job.key);
    }
  }

  // Schedule new job
  await usageCollectionQueue.add(
    'periodic-usage-collection',
    {},
    {
      repeat: {
        every: COLLECTION_INTERVAL_MINUTES * 60 * 1000, // Convert minutes to milliseconds
      },
    },
  );

  logger.info(
    { intervalMinutes: COLLECTION_INTERVAL_MINUTES },
    'Scheduled periodic usage collection job',
  );
}
