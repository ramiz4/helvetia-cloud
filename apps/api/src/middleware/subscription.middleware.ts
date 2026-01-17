import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolve, TOKENS } from '../di';
import { ForbiddenError } from '../errors';
import type { ISubscriptionService } from '../interfaces';

/**
 * Subscription status middleware
 * Ensures user has an active subscription before performing operations
 * Handles grace period for PAST_DUE subscriptions (7 days)
 */
export const requireActiveSubscription = async (request: FastifyRequest, _reply: FastifyReply) => {
  const subscriptionService = resolve<ISubscriptionService>(TOKENS.SubscriptionService);

  const userId = request.user?.id;
  if (!userId) {
    throw new ForbiddenError('User authentication required');
  }

  // Get subscription for user
  const subscription = await subscriptionService.getSubscription({ userId });

  if (!subscription) {
    throw new ForbiddenError(
      'No subscription found. Please subscribe to a plan to use this service.',
    );
  }

  // Check subscription status
  if (subscription.status === 'ACTIVE') {
    return; // Allow access
  }

  // Handle PAST_DUE with grace period
  if (subscription.status === 'PAST_DUE') {
    const gracePeriodDays = 7;
    const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const now = new Date();
    const timeSinceExpiry = now.getTime() - periodEnd.getTime();

    if (timeSinceExpiry < gracePeriodMs) {
      // Still within grace period - allow access but log warning
      request.log.warn(
        {
          userId,
          subscriptionId: subscription.id,
          daysSinceExpiry: Math.floor(timeSinceExpiry / (24 * 60 * 60 * 1000)),
        },
        'User accessing service during grace period',
      );
      return;
    }

    throw new ForbiddenError(
      'Your subscription payment is past due. Please update your payment method to continue using the service.',
    );
  }

  // Block CANCELED and UNPAID subscriptions
  if (subscription.status === 'CANCELED') {
    throw new ForbiddenError(
      'Your subscription has been canceled. Please resubscribe to continue using the service.',
    );
  }

  if (subscription.status === 'UNPAID') {
    throw new ForbiddenError(
      'Your subscription is unpaid. Please complete payment to continue using the service.',
    );
  }

  // Fallback for any other status
  throw new ForbiddenError('Your subscription is not active. Please check your billing status.');
};

/**
 * Resource limit enforcement middleware
 * Checks if user has exceeded their subscription tier limits
 * This should be called before creating new services or allocating resources
 */
export const enforceResourceLimits = (resourceType: 'service' | 'memory' | 'cpu') => {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const subscriptionService = resolve<ISubscriptionService>(TOKENS.SubscriptionService);

    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenError('User authentication required');
    }

    // Get subscription for user
    const subscription = await subscriptionService.getSubscription({ userId });

    if (!subscription) {
      throw new ForbiddenError('No subscription found. Please subscribe to a plan.');
    }

    // Get resource limits for the plan
    const limits = subscriptionService.getResourceLimits(subscription.plan);

    // Check if limits are unlimited (enterprise)
    if (resourceType === 'service' && limits.maxServices === -1) {
      return; // Unlimited services
    }

    if (resourceType === 'memory' && limits.maxMemoryMB === -1) {
      return; // Unlimited memory
    }

    if (resourceType === 'cpu' && limits.maxCPUCores === -1) {
      return; // Unlimited CPU
    }

    // Import PrismaClient dynamically to avoid circular dependencies
    const prismaModule = await import('database');
    const prisma = resolve<typeof prismaModule.PrismaClient>(TOKENS.PrismaClient);

    // Check service count limit
    if (resourceType === 'service') {
      const serviceCount = await prisma.service.count({
        where: {
          userId,
          deletedAt: null, // Only count non-deleted services
        },
      });

      if (serviceCount >= limits.maxServices) {
        throw new ForbiddenError(
          `Service limit reached. Your ${subscription.plan} plan allows ${limits.maxServices} service(s). Please upgrade your plan to create more services.`,
        );
      }
    }

    // Check memory limit
    if (resourceType === 'memory') {
      // Get all active services and sum their memory
      const services = await prisma.service.findMany({
        where: {
          userId,
          deletedAt: null,
          status: { not: 'STOPPED' },
        },
      });

      // Calculate total memory from request body
      const body = request.body as { envVars?: Record<string, unknown> };
      const requestedMemory = body.envVars?.['MEMORY_LIMIT']
        ? parseInt(String(body.envVars['MEMORY_LIMIT']), 10)
        : 512; // Default 512MB

      // Sum existing service memory (assuming default 512MB per service if not specified)
      const totalCurrentMemory = services.length * 512; // Simplified calculation
      const totalMemoryAfterCreation = totalCurrentMemory + requestedMemory;

      if (totalMemoryAfterCreation > limits.maxMemoryMB) {
        throw new ForbiddenError(
          `Memory limit exceeded. Your ${subscription.plan} plan allows ${limits.maxMemoryMB}MB total. Current usage: ${totalCurrentMemory}MB, requested: ${requestedMemory}MB. Please upgrade your plan.`,
        );
      }
    }

    // Check CPU limit
    if (resourceType === 'cpu') {
      const services = await prisma.service.findMany({
        where: {
          userId,
          deletedAt: null,
          status: { not: 'STOPPED' },
        },
      });

      // Calculate total CPU from request body
      const body = request.body as { envVars?: Record<string, unknown> };
      const requestedCPU = body.envVars?.['CPU_LIMIT']
        ? parseFloat(String(body.envVars['CPU_LIMIT']))
        : 0.5; // Default 0.5 cores

      // Sum existing service CPU (assuming default 0.5 cores per service if not specified)
      const totalCurrentCPU = services.length * 0.5; // Simplified calculation
      const totalCPUAfterCreation = totalCurrentCPU + requestedCPU;

      if (totalCPUAfterCreation > limits.maxCPUCores) {
        throw new ForbiddenError(
          `CPU limit exceeded. Your ${subscription.plan} plan allows ${limits.maxCPUCores} CPU cores total. Current usage: ${totalCurrentCPU} cores, requested: ${requestedCPU} cores. Please upgrade your plan.`,
        );
      }
    }
  };
};
