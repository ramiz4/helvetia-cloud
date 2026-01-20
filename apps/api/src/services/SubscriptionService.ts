import { PrismaClient, SubscriptionPlan, SubscriptionStatus } from 'database';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens.js';
import type { ISubscriptionService } from '../interfaces/index.js';

/**
 * Duration for virtual FREE subscription (10 years in milliseconds)
 * This provides effectively unlimited access for free tier users without requiring
 * explicit database records. The 10-year period ensures users won't face unexpected
 * expiration while being far enough in the future to not require maintenance.
 */
const VIRTUAL_FREE_SUBSCRIPTION_DURATION_MS = 10 * 365 * 24 * 60 * 60 * 1000;

/**
 * Resource limits for each subscription plan
 */
const PLAN_LIMITS = {
  FREE: {
    maxServices: 1,
    maxMemoryMB: 512,
    maxCPUCores: 0.5,
    maxBandwidthGB: 10,
    maxStorageGB: 5,
  },
  STARTER: {
    maxServices: 5,
    maxMemoryMB: 2048,
    maxCPUCores: 2,
    maxBandwidthGB: 100,
    maxStorageGB: 50,
  },
  PRO: {
    maxServices: 20,
    maxMemoryMB: 8192,
    maxCPUCores: 8,
    maxBandwidthGB: 500,
    maxStorageGB: 200,
  },
  ENTERPRISE: {
    maxServices: -1, // Unlimited
    maxMemoryMB: -1, // Unlimited
    maxCPUCores: -1, // Unlimited
    maxBandwidthGB: -1, // Unlimited
    maxStorageGB: -1, // Unlimited
  },
} as const;

/**
 * SubscriptionService
 * Handles subscription database operations
 */
@injectable()
export class SubscriptionService implements ISubscriptionService {
  constructor(
    @inject(TOKENS.PrismaClient)
    private prisma: PrismaClient,
  ) {}

  /**
   * Get subscription for a user or organization
   */
  async getSubscription(params: { userId?: string; organizationId?: string }): Promise<{
    id: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  } | null> {
    if (!params.userId && !params.organizationId) {
      throw new Error('Either userId or organizationId must be provided for getSubscription');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: params.userId,
        organizationId: params.organizationId,
      },
    });

    if (subscription) {
      return subscription;
    }

    // Return a virtual FREE subscription for users without one
    // This allows access to free tier resources without requiring a database record
    // Organizations do not receive virtual subscriptions - they must explicitly subscribe
    if (params.userId) {
      return {
        // Virtual subscription, not persisted in the database
        id: 'virtual:free_default',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        // No Stripe customer - user has not subscribed to a paid plan
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + VIRTUAL_FREE_SUBSCRIPTION_DURATION_MS),
      };
    }

    return null;
  }

  /**
   * Create or update subscription
   */
  async upsertSubscription(params: {
    userId?: string;
    organizationId?: string;
    stripeCustomerId: string;
    stripeSubscriptionId?: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }): Promise<void> {
    if (!params.userId && !params.organizationId) {
      throw new Error('Either userId or organizationId must be provided for upsertSubscription');
    }

    // Try to find existing subscription
    const existing = await this.prisma.subscription.findFirst({
      where: {
        userId: params.userId,
        organizationId: params.organizationId,
      },
    });

    if (existing) {
      // Update existing
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          stripeCustomerId: params.stripeCustomerId,
          stripeSubscriptionId: params.stripeSubscriptionId,
          plan: params.plan,
          status: params.status,
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
        },
      });
    } else {
      // Create new
      await this.prisma.subscription.create({
        data: {
          userId: params.userId,
          organizationId: params.organizationId,
          stripeCustomerId: params.stripeCustomerId,
          stripeSubscriptionId: params.stripeSubscriptionId,
          plan: params.plan,
          status: params.status,
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
        },
      });
    }
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(params: {
    stripeSubscriptionId: string;
    status: SubscriptionStatus;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<void> {
    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: params.stripeSubscriptionId },
      data: {
        status: params.status,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
      },
    });
  }

  /**
   * Check if user/organization has active subscription
   */
  async hasActiveSubscription(params: {
    userId?: string;
    organizationId?: string;
  }): Promise<boolean> {
    const subscription = await this.getSubscription(params);
    return subscription?.status === 'ACTIVE';
  }

  /**
   * Get resource limits for a subscription plan
   */
  getResourceLimits(plan: SubscriptionPlan): {
    maxServices: number;
    maxMemoryMB: number;
    maxCPUCores: number;
    maxBandwidthGB: number;
    maxStorageGB: number;
  } {
    return PLAN_LIMITS[plan];
  }
}
