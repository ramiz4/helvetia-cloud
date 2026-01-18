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

describe('Subscription Middleware - Edge Cases and Error Handling', () => {
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
    mockSubscriptionService = {
      getSubscription: vi.fn(),
      upsertSubscription: vi.fn(),
      updateSubscriptionStatus: vi.fn(),
      hasActiveSubscription: vi.fn(),
      getResourceLimits: vi.fn(),
    };

    mockPrisma = {
      service: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };

    mockRequest = {
      user: { id: 'user-123', username: 'testuser', role: 'MEMBER' },
      body: {},
      log: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      } as unknown as FastifyRequest['log'],
    };
    mockReply = {};

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

  describe('Grace Period Edge Cases', () => {
    it('should allow access at exact grace period boundary (7 days)', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Exactly 7 days ago

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
    });

    it('should block access 1 second after grace period', async () => {
      const now = new Date();
      const periodEnd = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000 + 1000)); // 7 days + 1 second ago

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

    it('should handle PAST_DUE with future period end (edge case)', async () => {
      const now = new Date();
      const futurePeriodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days in future

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: futurePeriodEnd,
      });

      // Should allow access since period hasn't ended yet
      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.toBeUndefined();
    });

    it('should handle PAST_DUE with very old period end', async () => {
      const now = new Date();
      const veryOldPeriodEnd = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('2023-01-01'),
        currentPeriodEnd: veryOldPeriodEnd,
      });

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should handle multiple rapid checks during grace period', async () => {
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

      // Multiple rapid requests
      const promises = Array.from({ length: 10 }, () =>
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      );

      const results = await Promise.allSettled(promises);
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    });
  });

  describe('Resource Limit Edge Cases', () => {
    describe('Service Count Limits', () => {
      it('should handle race condition when creating service at limit', async () => {
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

        // Simulate race: count is 0 but another request is creating
        vi.mocked(mockPrisma.service.count).mockResolvedValue(0);

        const middleware = enforceResourceLimits('service');

        // Multiple simultaneous requests
        const promises = Array.from({ length: 5 }, () =>
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        );

        // All should pass the check (race condition at app level)
        const results = await Promise.allSettled(promises);
        expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      });

      it('should handle when service count exactly equals limit', async () => {
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

        vi.mocked(mockPrisma.service.count).mockResolvedValue(5); // Exactly at limit

        const middleware = enforceResourceLimits('service');
        await expect(
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).rejects.toThrow(ForbiddenError);
      });

      it('should handle database count query failures', async () => {
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

        vi.mocked(mockPrisma.service.count).mockRejectedValue(
          new Error('Database connection failed'),
        );

        const middleware = enforceResourceLimits('service');
        await expect(
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).rejects.toThrow('Database connection failed');
      });
    });

    describe('Memory Limit Edge Cases', () => {
      it('should handle missing MEMORY_LIMIT in envVars', async () => {
        mockRequest.body = {
          envVars: {},
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

        vi.mocked(mockPrisma.service.findMany).mockResolvedValue([] as never);

        const middleware = enforceResourceLimits('memory');
        // Should pass since no memory is specified
        await expect(
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).resolves.toBeUndefined();
      });

      it('should handle invalid MEMORY_LIMIT format', async () => {
        mockRequest.body = {
          envVars: {
            MEMORY_LIMIT: 'invalid-number',
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

        vi.mocked(mockPrisma.service.findMany).mockResolvedValue([] as never);

        const middleware = enforceResourceLimits('memory');
        // Should handle NaN gracefully
        await expect(
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).resolves.toBeUndefined();
      });

      it('should handle memory limit exactly at boundary', async () => {
        mockRequest.body = {
          envVars: {
            MEMORY_LIMIT: '2048', // Exactly at limit
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

        vi.mocked(mockPrisma.service.findMany).mockResolvedValue([] as never);

        const middleware = enforceResourceLimits('memory');
        // Should allow exactly at limit
        await expect(
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).resolves.toBeUndefined();
      });

      it('should handle memory limit 1MB over boundary', async () => {
        mockRequest.body = {
          envVars: {
            MEMORY_LIMIT: '2049',
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

        vi.mocked(mockPrisma.service.findMany).mockResolvedValue([] as never);

        const middleware = enforceResourceLimits('memory');
        await expect(
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).rejects.toThrow(ForbiddenError);
      });

      it('should handle extremely large memory values', async () => {
        mockRequest.body = {
          envVars: {
            MEMORY_LIMIT: '999999999',
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

    describe('CPU Limit Edge Cases', () => {
      it('should handle fractional CPU limits correctly', async () => {
        mockRequest.body = {
          envVars: {
            CPU_LIMIT: '0.5',
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
        ).resolves.toBeUndefined();
      });

      it('should handle CPU limit with floating point precision issues', async () => {
        mockRequest.body = {
          envVars: {
            CPU_LIMIT: '0.5000000001', // Floating point close to 0.5
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
        // Should allow due to tolerance
        await expect(
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).resolves.toBeUndefined();
      });

      it('should handle zero CPU limit', async () => {
        mockRequest.body = {
          envVars: {
            CPU_LIMIT: '0',
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

        vi.mocked(mockPrisma.service.findMany).mockResolvedValue([] as never);

        const middleware = enforceResourceLimits('cpu');
        await expect(
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).resolves.toBeUndefined();
      });
    });

    describe('Concurrent Limit Checks', () => {
      it('should handle concurrent resource limit checks', async () => {
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

        vi.mocked(mockPrisma.service.count).mockResolvedValue(2);

        const middleware = enforceResourceLimits('service');

        // Many concurrent checks
        const promises = Array.from({ length: 20 }, () =>
          middleware(mockRequest as FastifyRequest, mockReply as FastifyReply),
        );

        const results = await Promise.allSettled(promises);
        expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      });
    });
  });

  describe('Subscription Retrieval Edge Cases', () => {
    it('should handle database timeout when fetching subscription', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockRejectedValue(
        Object.assign(new Error('Database timeout'), {
          code: 'P2024',
        }),
      );

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Database timeout');
    });

    it('should handle null subscription service response', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue(null);

      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should handle subscription with null dates', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: null as any,
        currentPeriodEnd: null as any,
      });

      // Should handle gracefully and likely reject
      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow();
    });

    it('should handle subscription with invalid date objects', async () => {
      vi.mocked(mockSubscriptionService.getSubscription).mockResolvedValue({
        id: 'sub-123',
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.PAST_DUE,
        stripeCustomerId: 'cus-123',
        stripeSubscriptionId: 'sub-stripe-123',
        currentPeriodStart: new Date('invalid'),
        currentPeriodEnd: new Date('invalid'),
      });

      // Should handle Invalid Date objects
      await expect(
        requireActiveSubscription(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow();
    });
  });
});
