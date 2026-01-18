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

  describe('getResourceLimits', () => {
    it('should return limits for FREE plan', async () => {
      const limits = subscriptionService.getResourceLimits('FREE');

      expect(limits).toEqual(subscriptionPlans.FREE.limits);
      expect(limits.maxServices).toBe(1);
      expect(limits.maxMemoryMB).toBe(512);
    });

    it('should return limits for STARTER plan', async () => {
      const limits = subscriptionService.getResourceLimits('STARTER');

      expect(limits).toEqual(subscriptionPlans.STARTER.limits);
      expect(limits.maxServices).toBe(5);
      expect(limits.maxMemoryMB).toBe(2048);
    });

    it('should return limits for PRO plan', async () => {
      const limits = subscriptionService.getResourceLimits('PRO');

      expect(limits).toEqual(subscriptionPlans.PRO.limits);
      expect(limits.maxServices).toBe(20);
      expect(limits.maxMemoryMB).toBe(8192);
    });

    it('should return unlimited for ENTERPRISE plan', async () => {
      const limits = subscriptionService.getResourceLimits('ENTERPRISE');

      expect(limits).toEqual(subscriptionPlans.ENTERPRISE.limits);
      expect(limits.maxServices).toBe(-1);
      expect(limits.maxMemoryMB).toBe(-1);
    });
  });

  describe('updateSubscriptionStatus', () => {
    it('should update subscription status by stripe subscription ID', async () => {
      const stripeSubscriptionId = 'sub_test_123';
      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub-db-123',
        stripeSubscriptionId,
        status: 'PAST_DUE',
      });

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId,
        status: 'PAST_DUE',
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId },
        data: {
          status: 'PAST_DUE',
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
        },
      });
    });

    it('should update subscription status with period dates', async () => {
      const stripeSubscriptionId = 'sub_test_456';
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub-db-456',
        stripeSubscriptionId,
        status: 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId,
        status: 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });
    });
  });
});
