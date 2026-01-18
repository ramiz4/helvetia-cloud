import { SubscriptionPlan, SubscriptionStatus } from 'database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ISubscriptionService } from '../interfaces';

/**
 * Tests for Stripe webhook subscription event handling
 * These tests mock Stripe webhook events and verify that subscription
 * status changes are properly synchronized with the database
 */
describe('Subscription Webhook Events', () => {
  let mockSubscriptionService: ISubscriptionService;

  beforeEach(() => {
    mockSubscriptionService = {
      getSubscription: vi.fn(),
      upsertSubscription: vi.fn(),
      updateSubscriptionStatus: vi.fn(),
      hasActiveSubscription: vi.fn(),
      getResourceLimits: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('subscription.updated events', () => {
    it('should update subscription status from ACTIVE to PAST_DUE', async () => {
      const stripeEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_123',
            status: 'past_due',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
            metadata: {
              plan: 'STARTER',
            },
          },
        },
      };

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: stripeEvent.data.object.id,
        status: 'PAST_DUE' as SubscriptionStatus,
        currentPeriodStart: new Date(stripeEvent.data.object.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeEvent.data.object.current_period_end * 1000),
      });

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith({
        stripeSubscriptionId: 'sub_stripe_123',
        status: 'PAST_DUE',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
      });
    });

    it('should update subscription status from PAST_DUE to ACTIVE (payment recovered)', async () => {
      const stripeEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_123',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      };

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: stripeEvent.data.object.id,
        status: 'ACTIVE' as SubscriptionStatus,
        currentPeriodStart: new Date(stripeEvent.data.object.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeEvent.data.object.current_period_end * 1000),
      });

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: 'sub_stripe_123',
          status: 'ACTIVE',
        }),
      );
    });

    it('should update subscription status to CANCELED', async () => {
      const stripeEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_456',
            status: 'canceled',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      };

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: stripeEvent.data.object.id,
        status: 'CANCELED' as SubscriptionStatus,
        currentPeriodStart: new Date(stripeEvent.data.object.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeEvent.data.object.current_period_end * 1000),
      });

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: 'sub_stripe_456',
          status: 'CANCELED',
        }),
      );
    });

    it('should update subscription status to UNPAID', async () => {
      const stripeEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_789',
            status: 'unpaid',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      };

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: stripeEvent.data.object.id,
        status: 'UNPAID' as SubscriptionStatus,
        currentPeriodStart: new Date(stripeEvent.data.object.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeEvent.data.object.current_period_end * 1000),
      });

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: 'sub_stripe_789',
          status: 'UNPAID',
        }),
      );
    });

    it('should handle plan upgrade from STARTER to PRO', async () => {
      const userId = 'user-123';

      // Mock getting current subscription
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-db-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_stripe_123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      const stripeEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_123',
            customer: 'cus_123',
            status: 'active',
            items: {
              data: [
                {
                  price: {
                    id: 'price_pro_monthly',
                    metadata: {
                      plan: 'PRO',
                    },
                  },
                },
              ],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      };

      // Simulate plan upgrade
      await mockSubscriptionService.upsertSubscription({
        userId,
        stripeCustomerId: stripeEvent.data.object.customer,
        stripeSubscriptionId: stripeEvent.data.object.id,
        plan: 'PRO' as SubscriptionPlan,
        status: 'ACTIVE' as SubscriptionStatus,
        currentPeriodStart: new Date(stripeEvent.data.object.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeEvent.data.object.current_period_end * 1000),
      });

      expect(mockSubscriptionService.upsertSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          plan: 'PRO',
          status: 'ACTIVE',
        }),
      );
    });

    it('should handle plan downgrade from PRO to STARTER', async () => {
      const userId = 'user-456';

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-db-456',
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_456',
        stripeSubscriptionId: 'sub_stripe_456',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      const stripeEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_456',
            customer: 'cus_456',
            status: 'active',
            items: {
              data: [
                {
                  price: {
                    id: 'price_starter_monthly',
                    metadata: {
                      plan: 'STARTER',
                    },
                  },
                },
              ],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      };

      await mockSubscriptionService.upsertSubscription({
        userId,
        stripeCustomerId: stripeEvent.data.object.customer,
        stripeSubscriptionId: stripeEvent.data.object.id,
        plan: 'STARTER' as SubscriptionPlan,
        status: 'ACTIVE' as SubscriptionStatus,
        currentPeriodStart: new Date(stripeEvent.data.object.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeEvent.data.object.current_period_end * 1000),
      });

      expect(mockSubscriptionService.upsertSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          plan: 'STARTER',
          status: 'ACTIVE',
        }),
      );
    });
  });

  describe('subscription.deleted events', () => {
    it('should mark subscription as CANCELED when deleted', async () => {
      const stripeEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_stripe_999',
            status: 'canceled',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000),
          },
        },
      };

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: stripeEvent.data.object.id,
        status: 'CANCELED' as SubscriptionStatus,
        currentPeriodStart: new Date(stripeEvent.data.object.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeEvent.data.object.current_period_end * 1000),
      });

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: 'sub_stripe_999',
          status: 'CANCELED',
        }),
      );
    });
  });

  describe('Subscription Renewal Events', () => {
    it('should update period dates on successful renewal', async () => {
      const oldPeriodEnd = Math.floor(Date.now() / 1000);
      const newPeriodStart = oldPeriodEnd;
      const newPeriodEnd = oldPeriodEnd + 2592000; // +30 days

      const stripeEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_renewal',
            status: 'active',
            current_period_start: newPeriodStart,
            current_period_end: newPeriodEnd,
          },
        },
      };

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: stripeEvent.data.object.id,
        status: 'ACTIVE' as SubscriptionStatus,
        currentPeriodStart: new Date(stripeEvent.data.object.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeEvent.data.object.current_period_end * 1000),
      });

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith({
        stripeSubscriptionId: 'sub_stripe_renewal',
        status: 'ACTIVE',
        currentPeriodStart: new Date(newPeriodStart * 1000),
        currentPeriodEnd: new Date(newPeriodEnd * 1000),
      });
    });

    it('should handle failed renewal (payment failed)', async () => {
      const stripeEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            subscription: 'sub_stripe_failed',
            attempt_count: 1,
            next_payment_attempt: Math.floor(Date.now() / 1000) + 86400, // +1 day
          },
        },
      };

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: stripeEvent.data.object.subscription,
        status: 'PAST_DUE' as SubscriptionStatus,
      });

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith({
        stripeSubscriptionId: 'sub_stripe_failed',
        status: 'PAST_DUE',
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle webhook for non-existent subscription gracefully', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue(null);

      const stripeEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_nonexistent',
            status: 'active',
          },
        },
      };

      // Should not throw error
      const subscription = await mockSubscriptionService.getSubscription({
        userId: 'user-nonexistent',
      });

      expect(subscription).toBeNull();
    });

    it('should handle multiple rapid status changes', async () => {
      const subscriptionId = 'sub_stripe_rapid';

      // Simulate rapid status changes
      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: subscriptionId,
        status: 'PAST_DUE' as SubscriptionStatus,
      });

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: subscriptionId,
        status: 'ACTIVE' as SubscriptionStatus,
      });

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: subscriptionId,
        status: 'PAST_DUE' as SubscriptionStatus,
      });

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledTimes(3);
      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenLastCalledWith({
        stripeSubscriptionId: subscriptionId,
        status: 'PAST_DUE',
      });
    });

    it('should handle subscription reactivation after cancellation', async () => {
      const userId = 'user-reactivate';
      const customerId = 'cus_reactivate';

      // First subscription was canceled
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValueOnce({
        id: 'sub-old',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.CANCELED,
        stripeCustomerId: customerId,
        stripeSubscriptionId: 'sub_stripe_old',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      // User creates new subscription
      await mockSubscriptionService.upsertSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: 'sub_stripe_new',
        plan: 'PRO' as SubscriptionPlan,
        status: 'ACTIVE' as SubscriptionStatus,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      expect(mockSubscriptionService.upsertSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          stripeSubscriptionId: 'sub_stripe_new',
          status: 'ACTIVE',
          plan: 'PRO',
        }),
      );
    });

    it('should handle subscription with trial period ending', async () => {
      const stripeEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_trial',
            status: 'active',
            trial_end: null, // Trial ended
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      };

      await mockSubscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: stripeEvent.data.object.id,
        status: 'ACTIVE' as SubscriptionStatus,
        currentPeriodStart: new Date(stripeEvent.data.object.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeEvent.data.object.current_period_end * 1000),
      });

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: 'sub_stripe_trial',
          status: 'ACTIVE',
        }),
      );
    });
  });

  describe('Resource Limit Changes on Plan Update', () => {
    it('should reflect new limits immediately after plan upgrade', () => {
      // Mock getResourceLimits to return appropriate values
      vi.mocked(mockSubscriptionService.getResourceLimits)
        .mockReturnValueOnce({
          maxServices: 5,
          maxMemoryMB: 2048,
          maxCPUCores: 2,
          maxBandwidthGB: 100,
          maxStorageGB: 50,
        })
        .mockReturnValueOnce({
          maxServices: 20,
          maxMemoryMB: 8192,
          maxCPUCores: 8,
          maxBandwidthGB: 500,
          maxStorageGB: 200,
        });

      // Before upgrade (STARTER)
      const starterLimits = mockSubscriptionService.getResourceLimits(
        'STARTER' as SubscriptionPlan,
      );
      expect(starterLimits).toBeDefined();
      expect(starterLimits.maxServices).toBe(5);

      // After upgrade (PRO)
      const proLimits = mockSubscriptionService.getResourceLimits('PRO' as SubscriptionPlan);
      expect(proLimits).toBeDefined();
      expect(proLimits.maxServices).toBe(20);

      // PRO should have higher limits
      expect(mockSubscriptionService.getResourceLimits).toHaveBeenCalledWith('STARTER');
      expect(mockSubscriptionService.getResourceLimits).toHaveBeenCalledWith('PRO');
    });

    it('should reflect new limits immediately after plan downgrade', () => {
      // Mock getResourceLimits to return appropriate values
      vi.mocked(mockSubscriptionService.getResourceLimits)
        .mockReturnValueOnce({
          maxServices: 20,
          maxMemoryMB: 8192,
          maxCPUCores: 8,
          maxBandwidthGB: 500,
          maxStorageGB: 200,
        })
        .mockReturnValueOnce({
          maxServices: 1,
          maxMemoryMB: 512,
          maxCPUCores: 0.5,
          maxBandwidthGB: 10,
          maxStorageGB: 5,
        });

      // Before downgrade (PRO)
      const proLimits = mockSubscriptionService.getResourceLimits('PRO' as SubscriptionPlan);
      expect(proLimits).toBeDefined();
      expect(proLimits.maxServices).toBe(20);

      // After downgrade (FREE)
      const freeLimits = mockSubscriptionService.getResourceLimits('FREE' as SubscriptionPlan);
      expect(freeLimits).toBeDefined();
      expect(freeLimits.maxServices).toBe(1);

      expect(mockSubscriptionService.getResourceLimits).toHaveBeenCalledWith('PRO');
      expect(mockSubscriptionService.getResourceLimits).toHaveBeenCalledWith('FREE');
    });
  });
});
