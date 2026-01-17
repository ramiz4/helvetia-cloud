import type { SubscriptionPlan, SubscriptionStatus } from 'database';

/**
 * Subscription service interface
 * Handles subscription database operations
 */
export interface ISubscriptionService {
  /**
   * Get subscription for a user or organization
   */
  getSubscription(params: { userId?: string; organizationId?: string }): Promise<{
    id: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  } | null>;

  /**
   * Create or update subscription
   */
  upsertSubscription(params: {
    userId?: string;
    organizationId?: string;
    stripeCustomerId: string;
    stripeSubscriptionId?: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }): Promise<void>;

  /**
   * Update subscription status
   */
  updateSubscriptionStatus(params: {
    stripeSubscriptionId: string;
    status: SubscriptionStatus;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<void>;

  /**
   * Check if user/organization has active subscription
   */
  hasActiveSubscription(params: { userId?: string; organizationId?: string }): Promise<boolean>;

  /**
   * Get resource limits for a subscription plan
   */
  getResourceLimits(plan: SubscriptionPlan): {
    maxServices: number;
    maxMemoryMB: number;
    maxCPUCores: number;
    maxBandwidthGB: number;
    maxStorageGB: number;
  };
}
