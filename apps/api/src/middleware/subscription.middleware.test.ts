import { SubscriptionPlan, SubscriptionStatus } from 'database';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as di from '../di/index.js';
import { ForbiddenError } from '../errors/index.js';
import type { ISubscriptionService } from '../interfaces/index.js';
import { enforceResourceLimits, requireActiveSubscription } from './subscription.middleware.js';

// Mock dependencies
vi.mock('../di', () => ({
  resolve: vi.fn(),
  TOKENS: {
    SubscriptionService: Symbol.for('SubscriptionService'),
    PrismaClient: Symbol.for('PrismaClient'),
  },
}));

describe('Subscription Middleware', () => {
  let mockSubscriptionService: ISubscriptionService;
  let mockPrisma: {
    service: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    // Setup mock subscription service
    mockSubscriptionService = {
      getSubscription: vi.fn(),
      upsertSubscription: vi.fn(),
      updateSubscriptionStatus: vi.fn(),
      hasActiveSubscription: vi.fn(),
      getResourceLimits: vi.fn(),
    };

    // Setup mock Prisma client
    mockPrisma = {
      service: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };

    // Setup mock request and reply
    mockRequest = {
      user: { id: 'user-123', username: 'testuser', role: 'MEMBER' },
      body: {},
      log: {
        warn: vi.fn(),
      } as unknown as FastifyRequest['log'],
    };
    mockReply = {};

    // Mock the resolve function
    vi.mocked(di.resolve).mockImplementation((token: symbol) => {
      if (token.toString().includes('SubscriptionService')) {
        return mockSubscriptionService;
      }
      if (token.toString().includes('PrismaClient')) {
        return mockPrisma;
      }
      return null;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('requireActiveSubscription', () => {
    it('should allow access for ACTIVE subscription', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();

      expect(mockSubscriptionService.getSubscription).toHaveBeenCalledWith({
        userId: 'user-123',
      });
    });

    it('should allow access for PAST_DUE subscription within grace period', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: periodEnd,
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();

      expect(mockRequest.log?.warn).toHaveBeenCalled();
    });

    it('should block access for PAST_DUE subscription after grace period', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: periodEnd,
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should block access for CANCELED subscription', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.CANCELED,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should block access for UNPAID subscription', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.UNPAID,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should block access when no subscription found', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue(null);

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should block access when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('enforceResourceLimits - service', () => {
    it('should allow service creation when under limit', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 5,
        maxMemoryMB: 2048,
        maxCPUCores: 2,
        maxBandwidthGB: 100,
        maxStorageGB: 50,
      });

      vi.mocked(mockPrisma.service.count).mockResolvedValue(2); // 2 existing services

      const middleware = enforceResourceLimits('service');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();

      expect(mockPrisma.service.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          deletedAt: null,
        },
      });
    });

    it('should block service creation when at limit', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: null,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 1,
        maxMemoryMB: 512,
        maxCPUCores: 0.5,
        maxBandwidthGB: 10,
        maxStorageGB: 5,
      });

      vi.mocked(mockPrisma.service.count).mockResolvedValue(1); // Already at limit

      const middleware = enforceResourceLimits('service');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow unlimited services for ENTERPRISE plan', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.ENTERPRISE,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: -1, // Unlimited
        maxMemoryMB: -1,
        maxCPUCores: -1,
        maxBandwidthGB: -1,
        maxStorageGB: -1,
      });

      const middleware = enforceResourceLimits('service');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();

      // Should not check service count for unlimited plan
      expect(mockPrisma.service.count).not.toHaveBeenCalled();
    });
  });

  describe('enforceResourceLimits - memory', () => {
    it('should allow service creation when memory is under limit', async () => {
      mockRequest.body = {
        envVars: {
          MEMORY_LIMIT: '512',
        },
      };

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 5,
        maxMemoryMB: 2048,
        maxCPUCores: 2,
        maxBandwidthGB: 100,
        maxStorageGB: 50,
      });

      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([{ id: 'service-1' }] as never);

      const middleware = enforceResourceLimits('memory');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();
    });

    it('should block service creation when memory exceeds limit', async () => {
      mockRequest.body = {
        envVars: {
          MEMORY_LIMIT: '1024',
        },
      };

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: null,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 1,
        maxMemoryMB: 512,
        maxCPUCores: 0.5,
        maxBandwidthGB: 10,
        maxStorageGB: 5,
      });

      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([] as never);

      const middleware = enforceResourceLimits('memory');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('enforceResourceLimits - cpu', () => {
    it('should allow service creation when CPU is under limit', async () => {
      mockRequest.body = {
        envVars: {
          CPU_LIMIT: '0.5',
        },
      };

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 20,
        maxMemoryMB: 8192,
        maxCPUCores: 8,
        maxBandwidthGB: 500,
        maxStorageGB: 200,
      });

      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([
        { id: 'service-1' },
        { id: 'service-2' },
      ] as never);

      const middleware = enforceResourceLimits('cpu');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();
    });

    it('should block service creation when CPU exceeds limit', async () => {
      mockRequest.body = {
        envVars: {
          CPU_LIMIT: '2',
        },
      };

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: null,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 1,
        maxMemoryMB: 512,
        maxCPUCores: 0.5,
        maxBandwidthGB: 10,
        maxStorageGB: 5,
      });

      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([] as never);

      const middleware = enforceResourceLimits('cpu');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('requireActiveSubscription - Grace Period Edge Cases', () => {
    it('should allow access for PAST_DUE exactly at 7 days (grace period boundary)', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 1000); // Just under 7 days ago (6 days 23h 59m 59s)

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: periodEnd,
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();

      expect(mockRequest.log?.warn).toHaveBeenCalled();
    });

    it('should block access for PAST_DUE just after 7 days (beyond grace period)', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1000); // Just over 7 days ago (7 days and 1 second)

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: periodEnd,
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(/past due/i);
    });

    it('should allow access for PAST_DUE at day 0 (just expired)', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() - 1000); // Just expired 1 second ago

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: periodEnd,
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();

      expect(mockRequest.log?.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          subscriptionId: 'sub-123',
          daysSinceExpiry: 0,
        }),
        'User accessing service during grace period',
      );
    });

    it('should block access for PAST_DUE at day 15 (well beyond grace period)', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: periodEnd,
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('requireActiveSubscription - Subscription Transitions', () => {
    it('should properly handle transition from ACTIVE to CANCELED', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.CANCELED,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(/canceled/i);
    });

    it('should properly handle transition from PAST_DUE to UNPAID', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.UNPAID,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(/unpaid/i);
    });

    it('should block access for unknown subscription status', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: 'UNKNOWN' as SubscriptionStatus,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(/not active/i);
    });
  });

  describe('enforceResourceLimits - Plan Changes and Edge Cases', () => {
    it('should enforce lower limits after downgrade from PRO to STARTER', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER, // Downgraded to STARTER
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 5, // STARTER limit
        maxMemoryMB: 2048,
        maxCPUCores: 2,
        maxBandwidthGB: 100,
        maxStorageGB: 50,
      });

      // User has 6 services from when they were on PRO plan
      vi.mocked(mockPrisma.service.count).mockResolvedValue(6);

      const middleware = enforceResourceLimits('service');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(/Service limit reached/);
    });

    it('should allow more resources after upgrade from FREE to PRO', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.PRO, // Upgraded to PRO
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 20, // PRO limit
        maxMemoryMB: 8192,
        maxCPUCores: 8,
        maxBandwidthGB: 500,
        maxStorageGB: 200,
      });

      // User has 5 services
      vi.mocked(mockPrisma.service.count).mockResolvedValue(5);

      const middleware = enforceResourceLimits('service');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();
    });

    it('should enforce exact limit boundary for service count', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 5,
        maxMemoryMB: 2048,
        maxCPUCores: 2,
        maxBandwidthGB: 100,
        maxStorageGB: 50,
      });

      // User has exactly 5 services (at limit)
      vi.mocked(mockPrisma.service.count).mockResolvedValue(5);

      const middleware = enforceResourceLimits('service');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should enforce exact limit boundary for memory', async () => {
      mockRequest.body = {
        envVars: {
          MEMORY_LIMIT: '256',
        },
      };

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: null,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 1,
        maxMemoryMB: 512, // Limit is 512MB
        maxCPUCores: 0.5,
        maxBandwidthGB: 10,
        maxStorageGB: 5,
      });

      // One existing service with 512MB would mean 512MB used, adding 256MB = 768MB > 512MB limit
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([{ id: 'service-1' }] as never);

      const middleware = enforceResourceLimits('memory');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should handle service with no explicit memory limit (default to 512MB)', async () => {
      mockRequest.body = {}; // No envVars specified

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 5,
        maxMemoryMB: 2048,
        maxCPUCores: 2,
        maxBandwidthGB: 100,
        maxStorageGB: 50,
      });

      // One existing service (512MB default)
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([{ id: 'service-1' }] as never);

      const middleware = enforceResourceLimits('memory');
      // Should use default 512MB for new service: 512 (existing) + 512 (new) = 1024MB < 2048MB
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();
    });

    it('should handle service with no explicit CPU limit (default to 0.5 cores)', async () => {
      mockRequest.body = {}; // No envVars specified

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      vi.mocked(mockSubscriptionService.getResourceLimits).mockReturnValue({
        maxServices: 5,
        maxMemoryMB: 2048,
        maxCPUCores: 2,
        maxBandwidthGB: 100,
        maxStorageGB: 50,
      });

      // Two existing services (0.5 cores each)
      vi.mocked(mockPrisma.service.findMany).mockResolvedValue([
        { id: 'service-1' },
        { id: 'service-2' },
      ] as never);

      const middleware = enforceResourceLimits('cpu');
      // Should use default 0.5 cores: 0.5 + 0.5 + 0.5 = 1.5 cores < 2 cores
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();
    });
  });

  describe('enforceResourceLimits - Authentication Edge Cases', () => {
    it('should throw error when user is missing from request', async () => {
      mockRequest.user = undefined;

      const middleware = enforceResourceLimits('service');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(/authentication required/i);
    });

    it('should throw error when subscription not found for resource enforcement', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue(null);

      const middleware = enforceResourceLimits('service');
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(/No subscription found/);
    });
  });
});
