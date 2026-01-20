import { PrismaClient, SubscriptionPlan, SubscriptionStatus } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi, type MockedObject } from 'vitest';
import { SubscriptionService } from './SubscriptionService.js';

/**
 * Test fixtures for subscription data
 * These represent common subscription scenarios including trial periods, grace periods, and different plans
 */
const TEST_FIXTURES = {
  // User subscriptions
  activeUserSubscription: {
    id: 'sub-1',
    userId: 'user-1',
    organizationId: null,
    stripeCustomerId: 'cus_test123',
    stripeSubscriptionId: 'sub_test123',
    plan: SubscriptionPlan.STARTER,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastSuspensionAt: null,
    lastWarningEmailAt: null,
  },
  pastDueUserSubscription: {
    id: 'sub-2',
    userId: 'user-2',
    organizationId: null,
    stripeCustomerId: 'cus_test456',
    stripeSubscriptionId: 'sub_test456',
    plan: SubscriptionPlan.PRO,
    status: SubscriptionStatus.PAST_DUE,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    lastSuspensionAt: null,
    lastWarningEmailAt: null,
  },
  canceledUserSubscription: {
    id: 'sub-3',
    userId: 'user-3',
    organizationId: null,
    stripeCustomerId: 'cus_test789',
    stripeSubscriptionId: 'sub_test789',
    plan: SubscriptionPlan.FREE,
    status: SubscriptionStatus.CANCELED,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-20'),
    lastSuspensionAt: null,
    lastWarningEmailAt: null,
  },
  // Organization subscriptions
  activeOrgSubscription: {
    id: 'sub-4',
    userId: null,
    organizationId: 'org-1',
    stripeCustomerId: 'cus_org123',
    stripeSubscriptionId: 'sub_org123',
    plan: SubscriptionPlan.ENTERPRISE,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastSuspensionAt: null,
    lastWarningEmailAt: null,
  },
  unpaidOrgSubscription: {
    id: 'sub-5',
    userId: null,
    organizationId: 'org-2',
    stripeCustomerId: 'cus_org456',
    stripeSubscriptionId: 'sub_org456',
    plan: SubscriptionPlan.PRO,
    status: SubscriptionStatus.UNPAID,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-18'),
    lastSuspensionAt: null,
    lastWarningEmailAt: null,
  },
  // Subscription without Stripe subscription ID (trial or free tier)
  freeTrialSubscription: {
    id: 'sub-6',
    userId: 'user-4',
    organizationId: null,
    stripeCustomerId: 'cus_trial123',
    stripeSubscriptionId: null,
    plan: SubscriptionPlan.FREE,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastSuspensionAt: null,
    lastWarningEmailAt: null,
  },
};

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let mockPrisma: MockedObject<PrismaClient>;

  /**
   * Test setup
   * - Creates a fresh mock PrismaClient before each test
   * - Initializes SubscriptionService with the mock
   * - Clears all mocks to ensure test isolation
   */
  beforeEach(() => {
    // Create mock PrismaClient with proper typing
    mockPrisma = {
      subscription: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
      },
    } as any;

    subscriptionService = new SubscriptionService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('getSubscription', () => {
    it('should return subscription for userId', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.activeUserSubscription,
      );

      const result = await subscriptionService.getSubscription({ userId: 'user-1' });

      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: undefined,
        },
      });
      expect(result).toEqual(TEST_FIXTURES.activeUserSubscription);
    });

    it('should return subscription for organizationId', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.activeOrgSubscription,
      );

      const result = await subscriptionService.getSubscription({ organizationId: 'org-1' });

      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          organizationId: 'org-1',
        },
      });
      expect(result).toEqual(TEST_FIXTURES.activeOrgSubscription);
    });

    it('should return default FREE subscription when no subscription found for userId', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);

      const result = await subscriptionService.getSubscription({ userId: 'user-nonexistent' });

      expect(result).not.toBeNull();
      expect(result?.plan).toBe(SubscriptionPlan.FREE);
      expect(result?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result?.id).toBe('virtual:free_default');
      expect(result?.stripeCustomerId).toBeNull();
    });

    it('should return null when no subscription found for organizationId', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);

      const result = await subscriptionService.getSubscription({
        organizationId: 'org-nonexistent',
      });

      expect(result).toBeNull();
    });

    it('should return subscription with null stripeSubscriptionId for trial users', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.freeTrialSubscription,
      );

      const result = await subscriptionService.getSubscription({ userId: 'user-4' });

      expect(result).toEqual(TEST_FIXTURES.freeTrialSubscription);
      expect(result?.stripeSubscriptionId).toBeNull();
    });

    it('should throw error when neither userId nor organizationId provided', async () => {
      await expect(subscriptionService.getSubscription({})).rejects.toThrow(
        'Either userId or organizationId must be provided for getSubscription',
      );

      expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('upsertSubscription', () => {
    const newSubscriptionData = {
      userId: 'user-new',
      stripeCustomerId: 'cus_new123',
      stripeSubscriptionId: 'sub_new123',
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2024-01-15'),
      currentPeriodEnd: new Date('2024-02-15'),
    };

    it('should create new subscription when none exists', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.subscription.create).mockResolvedValue({
        id: 'sub-new',
        organizationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSuspensionAt: null,
        lastWarningEmailAt: null,
        ...newSubscriptionData,
      });

      await subscriptionService.upsertSubscription(newSubscriptionData);

      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-new',
          organizationId: undefined,
        },
      });
      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: newSubscriptionData,
      });
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should update existing subscription', async () => {
      const existingSubscription = TEST_FIXTURES.activeUserSubscription;
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(existingSubscription);
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue({
        ...existingSubscription,
        ...newSubscriptionData,
      });

      await subscriptionService.upsertSubscription({
        ...newSubscriptionData,
        userId: 'user-1',
      });

      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: undefined,
        },
      });
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: existingSubscription.id },
        data: {
          stripeCustomerId: newSubscriptionData.stripeCustomerId,
          stripeSubscriptionId: newSubscriptionData.stripeSubscriptionId,
          plan: newSubscriptionData.plan,
          status: newSubscriptionData.status,
          currentPeriodStart: newSubscriptionData.currentPeriodStart,
          currentPeriodEnd: newSubscriptionData.currentPeriodEnd,
        },
      });
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    });

    it('should create subscription for organization when none exists', async () => {
      const orgSubscriptionData = {
        organizationId: 'org-new',
        stripeCustomerId: 'cus_orgnew123',
        stripeSubscriptionId: 'sub_orgnew123',
        plan: SubscriptionPlan.ENTERPRISE,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2024-01-15'),
        currentPeriodEnd: new Date('2024-02-15'),
      };

      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.subscription.create).mockResolvedValue({
        id: 'sub-orgnew',
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSuspensionAt: null,
        lastWarningEmailAt: null,
        ...orgSubscriptionData,
      });

      await subscriptionService.upsertSubscription(orgSubscriptionData);

      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: orgSubscriptionData,
      });
    });

    it('should update organization subscription when it exists', async () => {
      const existingOrgSub = TEST_FIXTURES.activeOrgSubscription;
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(existingOrgSub);
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue(existingOrgSub);

      await subscriptionService.upsertSubscription({
        organizationId: 'org-1',
        stripeCustomerId: 'cus_org123_updated',
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2024-02-01'),
        currentPeriodEnd: new Date('2024-03-01'),
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: existingOrgSub.id },
        data: expect.objectContaining({
          plan: SubscriptionPlan.PRO,
        }),
      });
    });

    it('should handle subscription without stripeSubscriptionId (trial/free tier)', async () => {
      const trialData = {
        userId: 'user-trial',
        stripeCustomerId: 'cus_trial456',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2024-01-15'),
        currentPeriodEnd: new Date('2024-02-15'),
      };

      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.subscription.create).mockResolvedValue({
        id: 'sub-trial',
        organizationId: null,
        stripeSubscriptionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSuspensionAt: null,
        lastWarningEmailAt: null,
        ...trialData,
      });

      await subscriptionService.upsertSubscription(trialData);

      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: trialData,
      });
    });

    it('should throw error when neither userId nor organizationId provided', async () => {
      await expect(
        subscriptionService.upsertSubscription({
          stripeCustomerId: 'cus_invalid',
          plan: SubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
        }),
      ).rejects.toThrow('Either userId or organizationId must be provided for upsertSubscription');

      expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('updateSubscriptionStatus', () => {
    it('should update status and period dates', async () => {
      const updatedSub = {
        ...TEST_FIXTURES.activeUserSubscription,
        status: SubscriptionStatus.CANCELED,
      };
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue(updatedSub);

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: 'sub_test123',
        status: SubscriptionStatus.CANCELED,
        currentPeriodStart: new Date('2024-02-01'),
        currentPeriodEnd: new Date('2024-03-01'),
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: {
          status: SubscriptionStatus.CANCELED,
          currentPeriodStart: new Date('2024-02-01'),
          currentPeriodEnd: new Date('2024-03-01'),
        },
      });
    });

    it('should update status only without changing period dates', async () => {
      const updatedSub = {
        ...TEST_FIXTURES.activeUserSubscription,
        status: SubscriptionStatus.PAST_DUE,
      };
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue(updatedSub);

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: 'sub_test123',
        status: SubscriptionStatus.PAST_DUE,
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
        },
      });
    });

    it('should update to UNPAID status during grace period', async () => {
      const updatedSub = {
        ...TEST_FIXTURES.activeUserSubscription,
        status: SubscriptionStatus.UNPAID,
      };
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue(updatedSub);

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: 'sub_test123',
        status: SubscriptionStatus.UNPAID,
        currentPeriodStart: new Date('2024-02-01'),
        currentPeriodEnd: new Date('2024-03-01'),
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: {
          status: SubscriptionStatus.UNPAID,
          currentPeriodStart: new Date('2024-02-01'),
          currentPeriodEnd: new Date('2024-03-01'),
        },
      });
    });

    it('should handle status update for organization subscription', async () => {
      const updatedOrgSub = {
        ...TEST_FIXTURES.activeOrgSubscription,
        status: SubscriptionStatus.CANCELED,
      };
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue(updatedOrgSub);

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: 'sub_org123',
        status: SubscriptionStatus.CANCELED,
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_org123' },
        data: {
          status: SubscriptionStatus.CANCELED,
          currentPeriodStart: undefined,
          currentPeriodEnd: undefined,
        },
      });
    });
  });

  describe('hasActiveSubscription', () => {
    it('should return true for ACTIVE subscription', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.activeUserSubscription,
      );

      const result = await subscriptionService.hasActiveSubscription({ userId: 'user-1' });

      expect(result).toBe(true);
    });

    it('should return false for PAST_DUE subscription', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.pastDueUserSubscription,
      );

      const result = await subscriptionService.hasActiveSubscription({ userId: 'user-2' });

      expect(result).toBe(false);
    });

    it('should return false for CANCELED subscription', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.canceledUserSubscription,
      );

      const result = await subscriptionService.hasActiveSubscription({ userId: 'user-3' });

      expect(result).toBe(false);
    });

    it('should return false for UNPAID subscription (grace period)', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.unpaidOrgSubscription,
      );

      const result = await subscriptionService.hasActiveSubscription({ organizationId: 'org-2' });

      expect(result).toBe(false);
    });

    it('should return true (default FREE) when no subscription exists for userId', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);

      const result = await subscriptionService.hasActiveSubscription({
        userId: 'user-nonexistent',
      });

      expect(result).toBe(true);
    });

    it('should return false when no subscription exists for organizationId', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);

      const result = await subscriptionService.hasActiveSubscription({
        organizationId: 'org-nonexistent',
      });

      expect(result).toBe(false);
    });

    it('should return true for organization with active subscription', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.activeOrgSubscription,
      );

      const result = await subscriptionService.hasActiveSubscription({ organizationId: 'org-1' });

      expect(result).toBe(true);
    });

    it('should call getSubscription internally with correct params', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.activeUserSubscription,
      );

      await subscriptionService.hasActiveSubscription({ userId: 'user-1' });

      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: undefined,
        },
      });
    });
  });

  describe('getResourceLimits', () => {
    it('should return correct limits for FREE plan', () => {
      const limits = subscriptionService.getResourceLimits(SubscriptionPlan.FREE);

      expect(limits).toEqual({
        maxServices: 1,
        maxMemoryMB: 512,
        maxCPUCores: 0.5,
        maxBandwidthGB: 10,
        maxStorageGB: 5,
      });
    });

    it('should return correct limits for STARTER plan', () => {
      const limits = subscriptionService.getResourceLimits(SubscriptionPlan.STARTER);

      expect(limits).toEqual({
        maxServices: 5,
        maxMemoryMB: 2048,
        maxCPUCores: 2,
        maxBandwidthGB: 100,
        maxStorageGB: 50,
      });
    });

    it('should return correct limits for PRO plan', () => {
      const limits = subscriptionService.getResourceLimits(SubscriptionPlan.PRO);

      expect(limits).toEqual({
        maxServices: 20,
        maxMemoryMB: 8192,
        maxCPUCores: 8,
        maxBandwidthGB: 500,
        maxStorageGB: 200,
      });
    });

    it('should return correct limits for ENTERPRISE plan', () => {
      const limits = subscriptionService.getResourceLimits(SubscriptionPlan.ENTERPRISE);

      expect(limits).toEqual({
        maxServices: -1, // Unlimited
        maxMemoryMB: -1, // Unlimited
        maxCPUCores: -1, // Unlimited
        maxBandwidthGB: -1, // Unlimited
        maxStorageGB: -1, // Unlimited
      });
    });

    it('should return consistent limits across multiple calls for same plan', () => {
      const limits1 = subscriptionService.getResourceLimits(SubscriptionPlan.STARTER);
      const limits2 = subscriptionService.getResourceLimits(SubscriptionPlan.STARTER);

      expect(limits1).toEqual(limits2);
    });

    it('should have increasing limits from FREE to PRO plans', () => {
      const freeLimits = subscriptionService.getResourceLimits(SubscriptionPlan.FREE);
      const starterLimits = subscriptionService.getResourceLimits(SubscriptionPlan.STARTER);
      const proLimits = subscriptionService.getResourceLimits(SubscriptionPlan.PRO);

      // Verify progressive limits
      expect(starterLimits.maxServices).toBeGreaterThan(freeLimits.maxServices);
      expect(starterLimits.maxMemoryMB).toBeGreaterThan(freeLimits.maxMemoryMB);
      expect(starterLimits.maxCPUCores).toBeGreaterThan(freeLimits.maxCPUCores);
      expect(starterLimits.maxBandwidthGB).toBeGreaterThan(freeLimits.maxBandwidthGB);
      expect(starterLimits.maxStorageGB).toBeGreaterThan(freeLimits.maxStorageGB);

      expect(proLimits.maxServices).toBeGreaterThan(starterLimits.maxServices);
      expect(proLimits.maxMemoryMB).toBeGreaterThan(starterLimits.maxMemoryMB);
      expect(proLimits.maxCPUCores).toBeGreaterThan(starterLimits.maxCPUCores);
      expect(proLimits.maxBandwidthGB).toBeGreaterThan(starterLimits.maxBandwidthGB);
      expect(proLimits.maxStorageGB).toBeGreaterThan(starterLimits.maxStorageGB);
    });

    it('should not require Prisma client (synchronous method)', () => {
      // This test verifies that getResourceLimits is a pure function
      // that doesn't depend on external state or async operations
      const limits = subscriptionService.getResourceLimits(SubscriptionPlan.PRO);

      expect(limits).toBeDefined();
      expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  /**
   * Edge Cases and Error Scenarios
   * Testing boundary conditions and error handling
   */
  describe('Edge Cases', () => {
    it('should handle subscription with far future period end date', async () => {
      const farFuture = new Date('2099-12-31');
      const subscription = {
        ...TEST_FIXTURES.activeUserSubscription,
        currentPeriodEnd: farFuture,
      };

      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(subscription);

      const result = await subscriptionService.getSubscription({ userId: 'user-1' });

      expect(result?.currentPeriodEnd).toEqual(farFuture);
    });

    it('should handle subscription with past period end date', async () => {
      const past = new Date('2020-01-01');
      const subscription = {
        ...TEST_FIXTURES.canceledUserSubscription,
        currentPeriodEnd: past,
      };

      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(subscription);

      const result = await subscriptionService.getSubscription({ userId: 'user-3' });

      expect(result?.currentPeriodEnd).toEqual(past);
    });

    it('should handle transition from trial to paid subscription', async () => {
      // First call: trial subscription (no stripeSubscriptionId)
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.freeTrialSubscription,
      );

      // Update to paid subscription
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue({
        ...TEST_FIXTURES.freeTrialSubscription,
        stripeSubscriptionId: 'sub_paid123',
        plan: SubscriptionPlan.STARTER,
      });

      await subscriptionService.upsertSubscription({
        userId: 'user-4',
        stripeCustomerId: 'cus_trial123',
        stripeSubscriptionId: 'sub_paid123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2024-02-01'),
        currentPeriodEnd: new Date('2024-03-01'),
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: TEST_FIXTURES.freeTrialSubscription.id },
        data: expect.objectContaining({
          stripeSubscriptionId: 'sub_paid123',
          plan: SubscriptionPlan.STARTER,
        }),
      });
    });

    it('should handle downgrade from paid to free plan', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(
        TEST_FIXTURES.activeUserSubscription,
      );

      vi.mocked(mockPrisma.subscription.update).mockResolvedValue({
        ...TEST_FIXTURES.activeUserSubscription,
        plan: SubscriptionPlan.FREE,
        stripeSubscriptionId: null,
      });

      await subscriptionService.upsertSubscription({
        userId: 'user-1',
        stripeCustomerId: 'cus_test123',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2024-02-01'),
        currentPeriodEnd: new Date('2024-03-01'),
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: TEST_FIXTURES.activeUserSubscription.id },
        data: expect.objectContaining({
          plan: SubscriptionPlan.FREE,
        }),
      });
    });

    it('should handle stripeCustomerId change in existing subscription', async () => {
      // This tests updating a subscription where Stripe customer ID changes
      const subscriptionWithOldCustomer = {
        ...TEST_FIXTURES.activeUserSubscription,
        stripeCustomerId: 'cus_old123',
      };

      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(subscriptionWithOldCustomer);
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue({
        ...subscriptionWithOldCustomer,
        stripeCustomerId: 'cus_new123',
      });

      await subscriptionService.upsertSubscription({
        userId: 'user-1',
        stripeCustomerId: 'cus_new123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionWithOldCustomer.id },
        data: expect.objectContaining({
          stripeCustomerId: 'cus_new123',
        }),
      });
    });
  });

  /**
   * Stripe Integration Points
   * These tests verify that the service handles Stripe-related data correctly
   * even though Stripe API calls are mocked at a higher level (BillingService)
   */
  describe('Stripe Integration Points', () => {
    it('should store Stripe customer ID and subscription ID correctly', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.subscription.create).mockResolvedValue({
        id: 'sub-new',
        userId: 'user-1',
        organizationId: null,
        stripeCustomerId: 'cus_stripe123',
        stripeSubscriptionId: 'sub_stripe123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        lastSuspensionAt: null,
        lastWarningEmailAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await subscriptionService.upsertSubscription({
        userId: 'user-1',
        stripeCustomerId: 'cus_stripe123',
        stripeSubscriptionId: 'sub_stripe123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stripeCustomerId: 'cus_stripe123',
          stripeSubscriptionId: 'sub_stripe123',
        }),
      });
    });

    it('should handle webhook status updates from Stripe', async () => {
      // Simulates Stripe webhook updating subscription status
      const updatedSub = {
        ...TEST_FIXTURES.activeUserSubscription,
        status: SubscriptionStatus.PAST_DUE,
      };
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue(updatedSub);

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: 'sub_test123',
        status: SubscriptionStatus.PAST_DUE,
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: expect.objectContaining({
          status: SubscriptionStatus.PAST_DUE,
        }),
      });
    });

    it('should handle subscription cancellation from Stripe', async () => {
      const canceledSub = {
        ...TEST_FIXTURES.activeUserSubscription,
        status: SubscriptionStatus.CANCELED,
      };
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue(canceledSub);

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: 'sub_test123',
        status: SubscriptionStatus.CANCELED,
        currentPeriodStart: new Date('2024-02-01'),
        currentPeriodEnd: new Date('2024-03-01'),
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: {
          status: SubscriptionStatus.CANCELED,
          currentPeriodStart: new Date('2024-02-01'),
          currentPeriodEnd: new Date('2024-03-01'),
        },
      });
    });

    it('should handle subscription renewal from Stripe webhook', async () => {
      const renewedSub = {
        ...TEST_FIXTURES.activeUserSubscription,
        currentPeriodStart: new Date('2024-02-01'),
        currentPeriodEnd: new Date('2024-03-01'),
      };
      vi.mocked(mockPrisma.subscription.update).mockResolvedValue(renewedSub);

      await subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: 'sub_test123',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2024-02-01'),
        currentPeriodEnd: new Date('2024-03-01'),
      });

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_test123' },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date('2024-02-01'),
          currentPeriodEnd: new Date('2024-03-01'),
        },
      });
    });
  });
});
