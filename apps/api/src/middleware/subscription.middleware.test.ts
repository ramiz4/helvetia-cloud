import { SubscriptionPlan, SubscriptionStatus } from 'database';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as di from '../di';
import { ForbiddenError } from '../errors';
import type { ISubscriptionService } from '../interfaces';
import { enforceResourceLimits, requireActiveSubscription } from './subscription.middleware';

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
});
