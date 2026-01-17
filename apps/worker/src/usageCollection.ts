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

// Stripe configuration
const STRIPE_ENABLED =
  !!process.env.STRIPE_SECRET_KEY &&
  !!process.env.STRIPE_PRICE_ID_COMPUTE_HOURS &&
  !!process.env.STRIPE_PRICE_ID_MEMORY_GB_HOURS &&
  !!process.env.STRIPE_PRICE_ID_BANDWIDTH_GB &&
  !!process.env.STRIPE_PRICE_ID_STORAGE_GB;

// Redis connection
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create usage collection queue
export const usageCollectionQueue = new Queue('usage-collection', {
  connection: redisConnection,
});

/**
 * Report usage to Stripe for metered billing
 */
async function reportToStripe(periodStart: Date, periodEnd: Date) {
  if (!STRIPE_ENABLED) {
    logger.info('Stripe not configured, skipping usage reporting');
    return { reported: false, reason: 'Stripe not configured' };
  }

  try {
    // Import Stripe and BillingService dynamically to avoid errors if Stripe is not configured
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-11-20.acacia' });

    // Get all subscriptions with active status
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        stripeSubscriptionId: { not: null },
      },
      include: {
        user: {
          select: { id: true },
        },
        organization: {
          select: { id: true },
        },
      },
    });

    let successCount = 0;
    let errorCount = 0;

    for (const subscription of subscriptions) {
      try {
        // Get aggregated usage for this subscription's billing period
        const userId = subscription.userId || undefined;
        const organizationId = subscription.organizationId || undefined;

        const usage = await prisma.usageRecord.groupBy({
          by: ['metric'],
          where: {
            service: {
              userId: userId ? userId : undefined,
              environment: organizationId
                ? {
                    project: {
                      organizationId,
                    },
                  }
                : undefined,
            },
            periodStart: {
              gte: periodStart,
            },
            periodEnd: {
              lte: periodEnd,
            },
          },
          _sum: {
            quantity: true,
          },
        });

        if (usage.length === 0) {
          continue;
        }

        // Get subscription items from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId!,
          { expand: ['items'] },
        );

        // Map metric types to Stripe price IDs
        const priceIdMap = {
          COMPUTE_HOURS: process.env.STRIPE_PRICE_ID_COMPUTE_HOURS!,
          MEMORY_GB_HOURS: process.env.STRIPE_PRICE_ID_MEMORY_GB_HOURS!,
          BANDWIDTH_GB: process.env.STRIPE_PRICE_ID_BANDWIDTH_GB!,
          STORAGE_GB: process.env.STRIPE_PRICE_ID_STORAGE_GB!,
        };

        // Report each metric to Stripe
        for (const metricUsage of usage) {
          const quantity = metricUsage._sum.quantity || 0;
          if (quantity === 0) continue;

          const priceId = priceIdMap[metricUsage.metric as keyof typeof priceIdMap];

          // Find the subscription item for this price
          const subscriptionItem = stripeSubscription.items.data.find(
            (item) => item.price.id === priceId,
          );

          if (!subscriptionItem) {
            logger.warn(
              {
                metric: metricUsage.metric,
                priceId,
                subscriptionId: subscription.id,
              },
              'Subscription item not found for metric',
            );
            continue;
          }

          // Report usage to Stripe
          await stripe.subscriptionItems.createUsageRecord(subscriptionItem.id, {
            quantity: Math.round(quantity),
            timestamp: Math.floor(periodEnd.getTime() / 1000),
            action: 'increment',
          });

          logger.info(
            {
              metric: metricUsage.metric,
              quantity: Math.round(quantity),
              subscriptionId: subscription.id,
            },
            'Reported usage to Stripe',
          );
        }

        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(
          {
            err: error,
            subscriptionId: subscription.id,
          },
          'Failed to report usage to Stripe for subscription',
        );
      }
    }

    return {
      reported: true,
      subscriptionsProcessed: subscriptions.length,
      successCount,
      errorCount,
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to report usage to Stripe');
    throw error;
  }
}

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

      // Report to Stripe if enabled
      if (STRIPE_ENABLED) {
        const periodEnd = new Date();
        const periodStart = new Date(periodEnd.getTime() - COLLECTION_INTERVAL_MINUTES * 60 * 1000);

        const stripeResult = await reportToStripe(periodStart, periodEnd);

        if (stripeResult.reported) {
          logger.info(
            {
              subscriptionsProcessed: stripeResult.subscriptionsProcessed,
              successCount: stripeResult.successCount,
              errorCount: stripeResult.errorCount,
            },
            'Stripe usage reporting completed',
          );
        }

        return { ...result, stripe: stripeResult };
      }

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
    { intervalMinutes: COLLECTION_INTERVAL_MINUTES, stripeEnabled: STRIPE_ENABLED },
    'Scheduled periodic usage collection job',
  );
}
