import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from 'shared';

/**
 * Subscription Check Scheduler
 * Schedules periodic jobs to check subscription statuses and suspend services
 *
 * Jobs are scheduled to run every hour
 */

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const subscriptionCheckQueue = new Queue('subscription-checks', {
  connection: redisConnection,
});

/**
 * Schedule subscription check to run periodically
 * Default: Every hour
 */
export async function scheduleSubscriptionChecks(): Promise<void> {
  try {
    // Remove any existing repeatable jobs to avoid duplicates
    const repeatableJobs = await subscriptionCheckQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await subscriptionCheckQueue.removeRepeatableByKey(job.key);
    }

    // Schedule new job to run every hour
    await subscriptionCheckQueue.add(
      'check-subscriptions',
      { checkType: 'all' },
      {
        repeat: {
          pattern: '0 * * * *', // Every hour at minute 0
        },
        jobId: 'subscription-check-hourly',
      },
    );

    logger.info('Subscription check job scheduled to run every hour');
  } catch (error) {
    logger.error({
      error,
      message: 'Failed to schedule subscription check job',
    });
  }
}

/**
 * Trigger an immediate subscription check
 * Useful for testing or manual triggers
 */
export async function triggerSubscriptionCheck(): Promise<void> {
  try {
    await subscriptionCheckQueue.add('check-subscriptions-manual', { checkType: 'all' });
    logger.info('Manual subscription check triggered');
  } catch (error) {
    logger.error({
      error,
      message: 'Failed to trigger manual subscription check',
    });
  }
}

/**
 * Clean up scheduler resources
 */
export async function closeSubscriptionScheduler(): Promise<void> {
  await subscriptionCheckQueue.close();
  await redisConnection.quit();
}
