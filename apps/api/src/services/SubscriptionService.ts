import { PrismaClient, SubscriptionPlan, SubscriptionStatus } from 'database';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens.js';
import type { ISubscriptionService } from '../interfaces/index.js';

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
    stripeCustomerId: string;
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

    // Return a default FREE subscription for users without one
    // This allows access to free tier resources without manual subscription
    if (params.userId) {
      return {
        id: 'free_default',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: '',
        stripeSubscriptionId: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10), // 10 years
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
