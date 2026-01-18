import { Job, Worker } from 'bullmq';
import { prisma, SubscriptionStatus } from 'database';
import IORedis from 'ioredis';
import { logger } from 'shared';

/**
 * Subscription Check Worker
 * Runs periodically to check subscription statuses and suspend services when necessary
 *
 * This worker:
 * 1. Checks for past due subscriptions beyond grace period
 * 2. Checks for canceled/unpaid subscriptions
 * 3. Sends warning emails during grace period
 * 4. Suspends services when subscription is invalid
 */

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const GRACE_PERIOD_DAYS = 7;
const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Check if a subscription is within grace period
 */
function isWithinGracePeriod(currentPeriodEnd: Date): boolean {
  const now = new Date();
  const timeSinceExpiry = now.getTime() - new Date(currentPeriodEnd).getTime();
  return timeSinceExpiry < GRACE_PERIOD_MS && timeSinceExpiry >= 0;
}

/**
 * Calculate days since subscription expired
 */
function daysSinceExpiry(currentPeriodEnd: Date): number {
  const now = new Date();
  const timeSinceExpiry = now.getTime() - new Date(currentPeriodEnd).getTime();
  return Math.floor(timeSinceExpiry / (24 * 60 * 60 * 1000));
}

/**
 * Send warning email to user about subscription status
 * TODO: Implement email sending service
 */
async function sendWarningEmail(
  userId: string,
  email: string,
  subscriptionStatus: SubscriptionStatus,
  daysRemaining?: number,
): Promise<void> {
  // This is a placeholder for future email notification implementation
  logger.info({
    userId,
    email,
    subscriptionStatus,
    daysRemaining,
    message: 'Warning email would be sent',
  });

  // Future implementation:
  // await emailService.send({
  //   to: email,
  //   template: 'subscription-warning',
  //   data: { subscriptionStatus, daysRemaining }
  // });
}

/**
 * Suspend all services for a user and update last suspension timestamp
 */
async function suspendUserServices(
  userId: string,
  subscriptionId: string,
  reason: string,
): Promise<number> {
  const services = await prisma.service.findMany({
    where: {
      userId,
      deletedAt: null,
      status: { notIn: ['STOPPED', 'SUSPENDED'] },
    },
  });

  let suspendedCount = 0;

  for (const service of services) {
    try {
      // Update service status to SUSPENDED
      await prisma.service.update({
        where: { id: service.id },
        data: { status: 'SUSPENDED' },
      });

      suspendedCount++;
      logger.info({
        serviceId: service.id,
        serviceName: service.name,
        userId,
        reason,
        message: 'Service suspended due to subscription issue',
      });
    } catch (error) {
      logger.error({
        error,
        serviceId: service.id,
        userId,
        message: 'Failed to suspend service',
      });
    }
  }

  // Update last suspension timestamp on subscription
  if (suspendedCount > 0) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { lastSuspensionAt: new Date() },
    });
  }

  return suspendedCount;
}

/**
 * Process subscription check job
 */
async function processSubscriptionCheck(job: Job): Promise<void> {
  const { checkType = 'all' } = job.data;

  logger.info({
    jobId: job.id,
    checkType,
    message: 'Starting subscription check',
  });

  const now = new Date();

  // Find all subscriptions that need attention
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: {
        in: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.UNPAID, SubscriptionStatus.CANCELED],
      },
    },
    include: {
      user: true,
    },
  });

  let checkedCount = 0;
  let suspendedCount = 0;
  let warningsCount = 0;

  for (const subscription of subscriptions) {
    checkedCount++;

    try {
      const userId = subscription.userId;
      if (!userId) {
        // Organization subscriptions not yet implemented
        continue;
      }

      // Handle PAST_DUE subscriptions
      if (subscription.status === SubscriptionStatus.PAST_DUE) {
        const withinGracePeriod = isWithinGracePeriod(subscription.currentPeriodEnd);
        const daysElapsed = daysSinceExpiry(subscription.currentPeriodEnd);

        if (withinGracePeriod) {
          // Send warning email on specific days (1, 3, 5, 7) only once per day
          if ([1, 3, 5, 7].includes(daysElapsed)) {
            const lastWarning = subscription.lastWarningEmailAt;
            const shouldSendWarning =
              !lastWarning || now.getTime() - new Date(lastWarning).getTime() > 20 * 60 * 60 * 1000; // 20 hours to avoid missing next day

            if (shouldSendWarning) {
              const daysRemaining = GRACE_PERIOD_DAYS - daysElapsed;
              await sendWarningEmail(
                userId,
                subscription.user?.username || 'user',
                SubscriptionStatus.PAST_DUE,
                daysRemaining,
              );
              warningsCount++;

              // Update last warning timestamp
              await prisma.subscription.update({
                where: { id: subscription.id },
                data: { lastWarningEmailAt: now },
              });

              logger.info({
                subscriptionId: subscription.id,
                userId,
                daysElapsed,
                daysRemaining,
                message: 'Warning email sent for past due subscription',
              });
            }
          }
        } else {
          // Grace period expired - suspend services only if not already suspended recently
          const lastSuspension = subscription.lastSuspensionAt;
          const shouldSuspend =
            !lastSuspension || now.getTime() - new Date(lastSuspension).getTime() > 60 * 60 * 1000; // 1 hour

          if (shouldSuspend) {
            const suspended = await suspendUserServices(
              userId,
              subscription.id,
              'Subscription past due - grace period expired',
            );
            suspendedCount += suspended;

            logger.warn({
              subscriptionId: subscription.id,
              userId,
              servicesAffected: suspended,
              daysElapsed,
              message: 'Services suspended - past due grace period expired',
            });
          }
        }
      }

      // Handle UNPAID subscriptions - only suspend once
      if (subscription.status === SubscriptionStatus.UNPAID) {
        const lastSuspension = subscription.lastSuspensionAt;
        const shouldSuspend =
          !lastSuspension || now.getTime() - new Date(lastSuspension).getTime() > 60 * 60 * 1000;

        if (shouldSuspend) {
          const suspended = await suspendUserServices(
            userId,
            subscription.id,
            'Subscription unpaid',
          );
          suspendedCount += suspended;

          // Send warning email only once per day
          const lastWarning = subscription.lastWarningEmailAt;
          const shouldSendWarning =
            !lastWarning || now.getTime() - new Date(lastWarning).getTime() > 20 * 60 * 60 * 1000;

          if (shouldSendWarning) {
            await sendWarningEmail(
              userId,
              subscription.user?.username || 'user',
              SubscriptionStatus.UNPAID,
            );
            warningsCount++;

            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { lastWarningEmailAt: now },
            });
          }

          logger.warn({
            subscriptionId: subscription.id,
            userId,
            servicesAffected: suspended,
            message: 'Services suspended - subscription unpaid',
          });
        }
      }

      // Handle CANCELED subscriptions - only suspend once
      if (subscription.status === SubscriptionStatus.CANCELED) {
        const lastSuspension = subscription.lastSuspensionAt;
        const shouldSuspend =
          !lastSuspension || now.getTime() - new Date(lastSuspension).getTime() > 60 * 60 * 1000;

        if (shouldSuspend) {
          const suspended = await suspendUserServices(
            userId,
            subscription.id,
            'Subscription canceled',
          );
          suspendedCount += suspended;

          // Send warning email only once per day
          const lastWarning = subscription.lastWarningEmailAt;
          const shouldSendWarning =
            !lastWarning || now.getTime() - new Date(lastWarning).getTime() > 20 * 60 * 60 * 1000;

          if (shouldSendWarning) {
            await sendWarningEmail(
              userId,
              subscription.user?.username || 'user',
              SubscriptionStatus.CANCELED,
            );
            warningsCount++;

            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { lastWarningEmailAt: now },
            });
          }

          logger.warn({
            subscriptionId: subscription.id,
            userId,
            servicesAffected: suspended,
            message: 'Services suspended - subscription canceled',
          });
        }
      }
    } catch (error) {
      logger.error({
        error,
        subscriptionId: subscription.id,
        message: 'Error processing subscription',
      });
    }
  }

  logger.info({
    jobId: job.id,
    checkedCount,
    suspendedCount,
    warningsCount,
    message: 'Subscription check completed',
  });

  // Update job result
  return {
    checkedCount,
    suspendedCount,
    warningsCount,
    timestamp: now.toISOString(),
  } as never;
}

/**
 * Create and export subscription check worker
 */
export const subscriptionCheckWorker = new Worker('subscription-checks', processSubscriptionCheck, {
  connection: redisConnection,
  limiter: {
    max: 1, // Only allow 1 concurrent job
    duration: 60000, // Per minute
  },
});

subscriptionCheckWorker.on('completed', (job) => {
  logger.info({
    jobId: job.id,
    message: 'Subscription check job completed',
  });
});

subscriptionCheckWorker.on('failed', (job, error) => {
  logger.error({
    jobId: job?.id,
    error,
    message: 'Subscription check job failed',
  });
});

subscriptionCheckWorker.on('error', (error) => {
  logger.error({
    error,
    message: 'Subscription check worker error',
  });
});

logger.info('Subscription check worker initialized');
