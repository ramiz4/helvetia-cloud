import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionService } from './SubscriptionService';
import {
  billingScenarios,
  createSubscriptionFixture,
  subscriptionPlans,
} from '../test/fixtures/billing.fixtures';

// Mock Prisma
const mockPrisma = {
  subscription: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  service: {
    count: vi.fn(),
  },
};

vi.mock('database', () => ({
  prisma: mockPrisma,
  PrismaClient: vi.fn(),
}));

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionService = new SubscriptionService(mockPrisma as any);
  });

  describe('getSubscription', () => {
    it('should get subscription for a user', async () => {
      const testSub = billingScenarios.starterWithUsage.subscription;
      mockPrisma.subscription.findFirst.mockResolvedValue(testSub);

      const subscription = await subscriptionService.getSubscription({
        userId: testSub.userId,
      });

      expect(subscription).toEqual(testSub);
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: testSub.userId,
          organizationId: undefined,
        },
      });
    });

    it('should get subscription for an organization', async () => {
      const orgId = 'org-123';
      const testSub = createSubscriptionFixture({
        organizationId: orgId,
        plan: 'PRO',
        stripeCustomerId: 'cus_test_org',
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(testSub);

      const subscription = await subscriptionService.getSubscription({
        organizationId: orgId,
      });

      expect(subscription).toEqual(testSub);
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          organizationId: orgId,
        },
      });
    });

    it('should return null if no subscription exists', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const subscription = await subscriptionService.getSubscription({
        userId: 'user-nonexistent',
      });

      expect(subscription).toBeNull();
    });

    it('should throw error if neither userId nor organizationId provided', async () => {
      await expect(subscriptionService.getSubscription({})).rejects.toThrow(
        'Either userId or organizationId must be provided',
      );
    });
  });

  describe('upsertSubscription', () => {
    it('should create new subscription if none exists', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({});

      const params = {
        userId: 'user-123',
        stripeCustomerId: 'cus_test_new',
        stripeSubscriptionId: 'sub_test_new',
        plan: 'STARTER' as const,
        status: 'ACTIVE' as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      await subscriptionService.upsertSubscription(params);

      expect(mockPrisma.subscription.create).toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should update existing subscription', async () => {
      const existingSub = billingScenarios.starterWithUsage.subscription;
      mockPrisma.subscription.findFirst.mockResolvedValue(existingSub);
      mockPrisma.subscription.update.mockResolvedValue({});

      const params = {
        userId: existingSub.userId,
        stripeCustomerId: existingSub.stripeCustomerId,
        stripeSubscriptionId: 'sub_test_updated',
        plan: 'PRO' as const,
        status: 'ACTIVE' as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      await subscriptionService.upsertSubscription(params);

      expect(mockPrisma.subscription.update).toHaveBeenCalled();
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    });

    it('should throw error if neither userId nor organizationId provided', async () => {
      const params = {
        stripeCustomerId: 'cus_test',
        plan: 'FREE' as const,
        status: 'ACTIVE' as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      };

      await expect(subscriptionService.upsertSubscription(params as any)).rejects.toThrow(
        'Either userId or organizationId must be provided',
      );
    });
  });

  describe('getPlanLimits', () => {
    it('should return limits for FREE plan', async () => {
      const limits = await subscriptionService.getPlanLimits('FREE');

      expect(limits).toEqual(subscriptionPlans.FREE.limits);
      expect(limits.maxServices).toBe(1);
      expect(limits.maxMemoryMB).toBe(512);
    });

    it('should return limits for STARTER plan', async () => {
      const limits = await subscriptionService.getPlanLimits('STARTER');

      expect(limits).toEqual(subscriptionPlans.STARTER.limits);
      expect(limits.maxServices).toBe(5);
      expect(limits.maxMemoryMB).toBe(2048);
    });

    it('should return limits for PRO plan', async () => {
      const limits = await subscriptionService.getPlanLimits('PRO');

      expect(limits).toEqual(subscriptionPlans.PRO.limits);
      expect(limits.maxServices).toBe(20);
      expect(limits.maxMemoryMB).toBe(8192);
    });

    it('should return unlimited for ENTERPRISE plan', async () => {
      const limits = await subscriptionService.getPlanLimits('ENTERPRISE');

      expect(limits).toEqual(subscriptionPlans.ENTERPRISE.limits);
      expect(limits.maxServices).toBe(-1);
      expect(limits.maxMemoryMB).toBe(-1);
    });
  });

  describe('checkServiceLimit', () => {
    it('should allow creating service within FREE plan limits', async () => {
      mockPrisma.service.count.mockResolvedValue(0);

      const canCreate = await subscriptionService.checkServiceLimit('user-123', 'FREE');

      expect(canCreate).toBe(true);
      expect(mockPrisma.service.count).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should prevent creating service beyond FREE plan limits', async () => {
      mockPrisma.service.count.mockResolvedValue(1); // Already at limit

      const canCreate = await subscriptionService.checkServiceLimit('user-123', 'FREE');

      expect(canCreate).toBe(false);
    });

    it('should allow creating multiple services on STARTER plan', async () => {
      mockPrisma.service.count.mockResolvedValue(3);

      const canCreate = await subscriptionService.checkServiceLimit('user-456', 'STARTER');

      expect(canCreate).toBe(true);
    });

    it('should prevent creating service beyond STARTER plan limits', async () => {
      mockPrisma.service.count.mockResolvedValue(5); // At limit

      const canCreate = await subscriptionService.checkServiceLimit('user-456', 'STARTER');

      expect(canCreate).toBe(false);
    });

    it('should always allow creating services on ENTERPRISE plan', async () => {
      mockPrisma.service.count.mockResolvedValue(1000); // Way over any normal limit

      const canCreate = await subscriptionService.checkServiceLimit(
        'user-enterprise',
        'ENTERPRISE',
      );

      expect(canCreate).toBe(true);
    });
  });

  describe('isActive', () => {
    it('should return true for ACTIVE subscription', () => {
      expect(subscriptionService.isActive('ACTIVE')).toBe(true);
    });

    it('should return false for PAST_DUE subscription', () => {
      expect(subscriptionService.isActive('PAST_DUE')).toBe(false);
    });

    it('should return false for CANCELED subscription', () => {
      expect(subscriptionService.isActive('CANCELED')).toBe(false);
    });

    it('should return false for UNPAID subscription', () => {
      expect(subscriptionService.isActive('UNPAID')).toBe(false);
    });
  });

  describe('cancelSubscription', () => {
    it('should update subscription status to CANCELED', async () => {
      const testSub = billingScenarios.starterWithUsage.subscription;
      mockPrisma.subscription.findFirst.mockResolvedValue(testSub);
      mockPrisma.subscription.update.mockResolvedValue({
        ...testSub,
        status: 'CANCELED',
      });

      await subscriptionService.cancelSubscription({
        userId: testSub.userId,
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: testSub.id },
        data: { status: 'CANCELED' },
      });
    });

    it('should handle canceling organization subscription', async () => {
      const orgId = 'org-789';
      const testSub = createSubscriptionFixture({
        organizationId: orgId,
        plan: 'PRO',
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(testSub);
      mockPrisma.subscription.update.mockResolvedValue({
        ...testSub,
        status: 'CANCELED',
      });

      await subscriptionService.cancelSubscription({
        organizationId: orgId,
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalled();
    });

    it('should throw error if subscription not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(
        subscriptionService.cancelSubscription({ userId: 'user-nonexistent' }),
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('updateSubscriptionStatus', () => {
    it('should update subscription status', async () => {
      const testSub = billingScenarios.starterWithUsage.subscription;
      mockPrisma.subscription.findFirst.mockResolvedValue(testSub);
      mockPrisma.subscription.update.mockResolvedValue({
        ...testSub,
        status: 'PAST_DUE',
      });

      await subscriptionService.updateSubscriptionStatus({
        userId: testSub.userId,
        status: 'PAST_DUE',
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: testSub.id },
        data: { status: 'PAST_DUE' },
      });
    });
  });
});
