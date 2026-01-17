import { PrismaClient, SubscriptionPlan } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionService } from './SubscriptionService';
import { testSubscriptions, planLimits } from '../test/fixtures/billing.fixtures';

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let mockPrisma: any;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      subscription: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaClient;

    // Create service instance
    subscriptionService = new SubscriptionService(mockPrisma);
  });

  describe('getSubscription', () => {
    it('should retrieve subscription for a user', async () => {
      const mockSubscription = testSubscriptions.starter;
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      const result = await subscriptionService.getSubscription({ userId: 'user-1' });

      expect(result).toEqual(mockSubscription);
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: undefined,
        },
      });
    });

    it('should retrieve subscription for an organization', async () => {
      const mockSubscription = { ...testSubscriptions.starter, organizationId: 'org-1' };
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      const result = await subscriptionService.getSubscription({ organizationId: 'org-1' });

      expect(result).toEqual(mockSubscription);
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          organizationId: 'org-1',
        },
      });
    });

    it('should return null if subscription not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const result = await subscriptionService.getSubscription({ userId: 'user-nonexistent' });

      expect(result).toBeNull();
    });

    it('should throw error if neither userId nor organizationId provided', async () => {
      await expect(subscriptionService.getSubscription({})).rejects.toThrow(
        'Either userId or organizationId must be provided for getSubscription',
      );
    });
  });

  describe('upsertSubscription', () => {
    it('should create a new subscription if none exists', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue(testSubscriptions.starter);

      await subscriptionService.upsertSubscription({
        userId: 'user-1',
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test123',
        plan: 'STARTER',
        status: 'ACTIVE',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          organizationId: undefined,
          stripeCustomerId: 'cus_test123',
          stripeSubscriptionId: 'sub_test123',
          plan: 'STARTER',
          status: 'ACTIVE',
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
        },
      });
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should update existing subscription', async () => {
      const existingSubscription = testSubscriptions.starter;
      mockPrisma.subscription.findFirst.mockResolvedValue(existingSubscription);
      mockPrisma.subscription.update.mockResolvedValue({
        ...existingSubscription,
        plan: 'PRO',
      });

      await subscriptionService.upsertSubscription({
        userId: 'user-1',
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test123',
        plan: 'PRO',
        status: 'ACTIVE',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: existingSubscription.id },
        data: {
          stripeCustomerId: 'cus_test123',
          stripeSubscriptionId: 'sub_test123',
          plan: 'PRO',
          status: 'ACTIVE',
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
        },
      });
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    });

    it('should support organization subscriptions', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({});

      await subscriptionService.upsertSubscription({
        organizationId: 'org-1',
        stripeCustomerId: 'cus_test123',
        plan: 'STARTER',
        status: 'ACTIVE',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          organizationId: 'org-1',
          stripeCustomerId: 'cus_test123',
          stripeSubscriptionId: undefined,
          plan: 'STARTER',
          status: 'ACTIVE',
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
        },
      });
    });

    it('should throw error if neither userId nor organizationId provided', async () => {
      await expect(
        subscriptionService.upsertSubscription({
          stripeCustomerId: 'cus_test123',
          plan: 'STARTER',
          status: 'ACTIVE',
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
        }),
      ).rejects.toThrow('Either userId or organizationId must be provided for upsertSubscription');
    });
  });

  describe('updateSubscriptionStatus', () => {
    it('should update subscription status', async () => {
      mockPrisma.subscription.update.mockResolvedValue({
        ...testSubscriptions.starter,
        status: 'PAST_DUE',
      });

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: 'sub_test123',
        status: 'PAST_DUE',
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: {
          status: 'PAST_DUE',
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
        },
      });
    });

    it('should update subscription status with period dates', async () => {
      const periodStart = new Date('2024-02-01');
      const periodEnd = new Date('2024-03-01');
      mockPrisma.subscription.update.mockResolvedValue({});

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: 'sub_test123',
        status: 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });
    });
  });

  describe('hasActiveSubscription', () => {
    it('should return true if user has active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(testSubscriptions.starter);

      const result = await subscriptionService.hasActiveSubscription({ userId: 'user-1' });

      expect(result).toBe(true);
    });

    it('should return false if user has no subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const result = await subscriptionService.hasActiveSubscription({ userId: 'user-1' });

      expect(result).toBe(false);
    });

    it('should return false if user subscription is not active', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(testSubscriptions.canceled);

      const result = await subscriptionService.hasActiveSubscription({ userId: 'user-1' });

      expect(result).toBe(false);
    });

    it('should return false for past due subscriptions', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(testSubscriptions.pastDue);

      const result = await subscriptionService.hasActiveSubscription({ userId: 'user-1' });

      expect(result).toBe(false);
    });

    it('should work with organization subscriptions', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        ...testSubscriptions.starter,
        organizationId: 'org-1',
      });

      const result = await subscriptionService.hasActiveSubscription({ organizationId: 'org-1' });

      expect(result).toBe(true);
    });
  });

  describe('getResourceLimits', () => {
    it('should return correct limits for FREE plan', () => {
      const limits = subscriptionService.getResourceLimits('FREE');

      expect(limits).toEqual(planLimits.FREE);
    });

    it('should return correct limits for STARTER plan', () => {
      const limits = subscriptionService.getResourceLimits('STARTER');

      expect(limits).toEqual(planLimits.STARTER);
    });

    it('should return correct limits for PRO plan', () => {
      const limits = subscriptionService.getResourceLimits('PRO');

      expect(limits).toEqual(planLimits.PRO);
    });

    it('should return correct limits for ENTERPRISE plan', () => {
      const limits = subscriptionService.getResourceLimits('ENTERPRISE');

      expect(limits).toEqual(planLimits.ENTERPRISE);
    });

    it('should return unlimited (-1) for all ENTERPRISE limits', () => {
      const limits = subscriptionService.getResourceLimits('ENTERPRISE');

      expect(limits.maxServices).toBe(-1);
      expect(limits.maxMemoryMB).toBe(-1);
      expect(limits.maxCPUCores).toBe(-1);
      expect(limits.maxBandwidthGB).toBe(-1);
      expect(limits.maxStorageGB).toBe(-1);
    });

    it('should handle all valid plan types', () => {
      const plans: SubscriptionPlan[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
      
      plans.forEach((plan) => {
        const limits = subscriptionService.getResourceLimits(plan);
        
        expect(limits).toBeDefined();
        expect(typeof limits.maxServices).toBe('number');
        expect(typeof limits.maxMemoryMB).toBe('number');
        expect(typeof limits.maxCPUCores).toBe('number');
        expect(typeof limits.maxBandwidthGB).toBe('number');
        expect(typeof limits.maxStorageGB).toBe('number');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle subscription with null stripeSubscriptionId', async () => {
      const freeSubscription = testSubscriptions.free;
      mockPrisma.subscription.findFirst.mockResolvedValue(freeSubscription);

      const result = await subscriptionService.getSubscription({ userId: 'user-1' });

      expect(result?.stripeSubscriptionId).toBeNull();
    });

    it('should handle concurrent upsert operations', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({});

      const promises = Array.from({ length: 5 }, (_, i) =>
        subscriptionService.upsertSubscription({
          userId: `user-${i}`,
          stripeCustomerId: `cus_${i}`,
          plan: 'STARTER',
          status: 'ACTIVE',
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
        }),
      );

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle subscription period at boundary dates', async () => {
      const periodStart = new Date('2024-01-01T00:00:00.000Z');
      const periodEnd = new Date('2024-12-31T23:59:59.999Z');
      
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({});

      await subscriptionService.upsertSubscription({
        userId: 'user-1',
        stripeCustomerId: 'cus_test123',
        plan: 'STARTER',
        status: 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      const createCall = mockPrisma.subscription.create.mock.calls[0][0];
      expect(createCall.data.currentPeriodStart).toEqual(periodStart);
      expect(createCall.data.currentPeriodEnd).toEqual(periodEnd);
    });
  });
});
