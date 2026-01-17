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
 * @param collectedUsage Array of usage data with service and ownership information
 * @param periodStart Start of the collection period
 * @param periodEnd End of the collection period
 */
async function reportToStripe(
  collectedUsage: Array<{
    serviceId: string;
    userId?: string | null;
    organizationId?: string | null;
  }>,
  periodStart: Date,
  periodEnd: Date,
) {
  if (!STRIPE_ENABLED) {
    logger.info('Stripe not configured, skipping usage reporting');
    return { reported: false, reason: 'Stripe not configured' };
  }

  try {
    // Import Stripe dynamically to avoid errors if Stripe is not configured
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });

    // Use consistent timestamp for all Stripe reports
    const reportTimestamp = Math.floor(periodEnd.getTime() / 1000);

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
    const failedSubscriptions: string[] = [];

    for (const subscription of subscriptions) {
      try {
        // Filter services that belong to this subscription
        const subscriptionServices = collectedUsage.filter((u) => {
          if (subscription.userId) {
            // User-level subscription: match userId and ensure organizationId is null
            return u.userId === subscription.userId && !u.organizationId;
          } else if (subscription.organizationId) {
            // Organization-level subscription: match organizationId
            return u.organizationId === subscription.organizationId;
          }
          return false;
        });

        if (subscriptionServices.length === 0) {
          continue;
        }

        // Get aggregated usage for these services
        const serviceIds = subscriptionServices.map((s) => s.serviceId);
        const usage = await prisma.usageRecord.groupBy({
          by: ['metric'],
          where: {
            serviceId: {
              in: serviceIds,
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

          // Report usage to Stripe with consistent timestamp
          await stripe.rawRequest(
            'POST',
            `/v1/subscription_items/${subscriptionItem.id}/usage_records`,
            {
              quantity: Math.round(quantity),
              timestamp: reportTimestamp,
              action: 'increment',
            },
          );

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
        failedSubscriptions.push(subscription.id);
        logger.error(
          {
            err: error,
            subscriptionId: subscription.id,
          },
          'Failed to report usage to Stripe for subscription',
        );
      }
    }

    // If more than 20% of subscriptions failed, throw error to trigger job retry
    const failureRate = subscriptions.length > 0 ? errorCount / subscriptions.length : 0;
    if (failureRate > 0.2 && errorCount > 0) {
      throw new Error(
        `High failure rate in Stripe reporting: ${errorCount}/${subscriptions.length} subscriptions failed`,
      );
    }

    return {
      reported: true,
      subscriptionsProcessed: subscriptions.length,
      successCount,
      errorCount,
      failedSubscriptions: errorCount > 0 ? failedSubscriptions : undefined,
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

      // Report to Stripe if enabled - pass collected usage directly to avoid race conditions
      if (STRIPE_ENABLED && result.usage.length > 0) {
        // Get service ownership information for Stripe reporting
        const serviceIds = result.usage.map((u) => u.serviceId);
        const services = await prisma.service.findMany({
          where: {
            id: {
              in: serviceIds,
            },
          },
          select: {
            id: true,
            userId: true,
            environment: {
              select: {
                project: {
                  select: {
                    organizationId: true,
                  },
                },
              },
            },
          },
        });

        const usageWithOwnership = services.map((s) => ({
          serviceId: s.id,
          userId: s.userId,
          organizationId: s.environment?.project.organizationId || null,
        }));

        const stripeResult = await reportToStripe(
          usageWithOwnership,
          result.periodStart,
          result.periodEnd,
        );

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

        // Cleanup service connection
        await usageCollectionService.cleanup();

        return { ...result, stripe: stripeResult };
      }

      // Cleanup service connection
      await usageCollectionService.cleanup();

      return result;
    } catch (error) {
      logger.error({ err: error }, 'Usage collection failed');
      // Ensure cleanup even on error
      try {
        await usageCollectionService.cleanup();
      } catch (cleanupError) {
        logger.warn({ err: cleanupError }, 'Failed to cleanup after error');
      }
      throw error;
    }
  },
  {
    connection: redisConnection,
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
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  );

  logger.info(
    { intervalMinutes: COLLECTION_INTERVAL_MINUTES, stripeEnabled: STRIPE_ENABLED },
    'Scheduled periodic usage collection job',
  );
}
