import { PrismaClient, UsageMetric } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageTrackingService } from './UsageTrackingService';
import { testServices, testUsageRecords, usagePricing } from '../test/fixtures/billing.fixtures';

describe('UsageTrackingService', () => {
  let usageTrackingService: UsageTrackingService;
  let mockPrisma: any;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      usageRecord: {
        create: vi.fn(),
        groupBy: vi.fn(),
      },
      service: {
        findMany: vi.fn(),
      },
    } as unknown as PrismaClient;

    // Create service instance
    usageTrackingService = new UsageTrackingService(mockPrisma);
  });

  describe('recordUsage', () => {
    it('should record usage for a service', async () => {
      mockPrisma.usageRecord.create.mockResolvedValue(testUsageRecords.compute);

      await usageTrackingService.recordUsage({
        serviceId: 'service-1',
        metric: 'COMPUTE_HOURS',
        quantity: 100,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: {
          serviceId: 'service-1',
          metric: 'COMPUTE_HOURS',
          quantity: 100,
          timestamp: expect.any(Date),
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-02-01'),
        },
      });
    });

    it('should record different usage metrics', async () => {
      const metrics: UsageMetric[] = [
        'COMPUTE_HOURS',
        'MEMORY_GB_HOURS',
        'BANDWIDTH_GB',
        'STORAGE_GB',
      ];

      mockPrisma.usageRecord.create.mockResolvedValue({});

      for (const metric of metrics) {
        await usageTrackingService.recordUsage({
          serviceId: 'service-1',
          metric,
          quantity: 50,
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-02-01'),
        });
      }

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledTimes(4);
    });

    it('should handle fractional quantities', async () => {
      mockPrisma.usageRecord.create.mockResolvedValue({});

      await usageTrackingService.recordUsage({
        serviceId: 'service-1',
        metric: 'COMPUTE_HOURS',
        quantity: 123.456,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      const call = mockPrisma.usageRecord.create.mock.calls[0][0];
      expect(call.data.quantity).toBe(123.456);
    });

    it('should set timestamp to current time', async () => {
      const beforeCall = new Date();
      mockPrisma.usageRecord.create.mockResolvedValue({});

      await usageTrackingService.recordUsage({
        serviceId: 'service-1',
        metric: 'COMPUTE_HOURS',
        quantity: 100,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      const call = mockPrisma.usageRecord.create.mock.calls[0][0];
      const timestamp = call.data.timestamp;
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    });
  });

  describe('getServiceUsage', () => {
    it('should retrieve aggregated usage for a service', async () => {
      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: 100 } },
        { metric: 'MEMORY_GB_HOURS', _sum: { quantity: 50 } },
      ]);

      const result = await usageTrackingService.getServiceUsage({
        serviceId: 'service-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(result).toEqual([
        { metric: 'COMPUTE_HOURS', quantity: 100 },
        { metric: 'MEMORY_GB_HOURS', quantity: 50 },
      ]);

      expect(mockPrisma.usageRecord.groupBy).toHaveBeenCalledWith({
        by: ['metric'],
        where: {
          serviceId: 'service-1',
          periodStart: {
            gte: new Date('2024-01-01'),
          },
          periodEnd: {
            lte: new Date('2024-02-01'),
          },
        },
        _sum: {
          quantity: true,
        },
      });
    });

    it('should return empty array if no usage found', async () => {
      mockPrisma.usageRecord.groupBy.mockResolvedValue([]);

      const result = await usageTrackingService.getServiceUsage({
        serviceId: 'service-nonexistent',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(result).toEqual([]);
    });

    it('should handle null sum values', async () => {
      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: null } },
      ]);

      const result = await usageTrackingService.getServiceUsage({
        serviceId: 'service-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(result).toEqual([{ metric: 'COMPUTE_HOURS', quantity: 0 }]);
    });

    it('should filter by date range correctly', async () => {
      mockPrisma.usageRecord.groupBy.mockResolvedValue([]);

      const periodStart = new Date('2024-01-01T00:00:00Z');
      const periodEnd = new Date('2024-01-31T23:59:59Z');

      await usageTrackingService.getServiceUsage({
        serviceId: 'service-1',
        periodStart,
        periodEnd,
      });

      const call = mockPrisma.usageRecord.groupBy.mock.calls[0][0];
      expect(call.where.periodStart.gte).toEqual(periodStart);
      expect(call.where.periodEnd.lte).toEqual(periodEnd);
    });
  });

  describe('getAggregatedUsage', () => {
    it('should retrieve aggregated usage for all user services', async () => {
      mockPrisma.service.findMany.mockResolvedValue([
        testServices.service1,
        testServices.service2,
      ]);

      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: 200 } },
        { metric: 'MEMORY_GB_HOURS', _sum: { quantity: 100 } },
        { metric: 'BANDWIDTH_GB', _sum: { quantity: 50 } },
      ]);

      const result = await usageTrackingService.getAggregatedUsage({
        userId: 'user-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(result).toEqual([
        { metric: 'COMPUTE_HOURS', quantity: 200, cost: 2.0 },
        { metric: 'MEMORY_GB_HOURS', quantity: 100, cost: 0.5 },
        { metric: 'BANDWIDTH_GB', quantity: 50, cost: 6.0 },
      ]);

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          environment: undefined,
        },
        select: { id: true },
      });

      expect(mockPrisma.usageRecord.groupBy).toHaveBeenCalledWith({
        by: ['metric'],
        where: {
          serviceId: {
            in: ['service-1', 'service-2'],
          },
          periodStart: {
            gte: new Date('2024-01-01'),
          },
          periodEnd: {
            lte: new Date('2024-02-01'),
          },
        },
        _sum: {
          quantity: true,
        },
      });
    });

    it('should return empty array if user has no services', async () => {
      mockPrisma.service.findMany.mockResolvedValue([]);

      const result = await usageTrackingService.getAggregatedUsage({
        userId: 'user-empty',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(result).toEqual([]);
      expect(mockPrisma.usageRecord.groupBy).not.toHaveBeenCalled();
    });

    it('should support organization usage', async () => {
      mockPrisma.service.findMany.mockResolvedValue([testServices.service1]);
      mockPrisma.usageRecord.groupBy.mockResolvedValue([]);

      await usageTrackingService.getAggregatedUsage({
        userId: 'user-1',
        organizationId: 'org-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          environment: {
            project: {
              organizationId: 'org-1',
            },
          },
        },
        select: { id: true },
      });
    });

    it('should calculate costs correctly for all metrics', async () => {
      mockPrisma.service.findMany.mockResolvedValue([testServices.service1]);
      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: 100 } },
        { metric: 'MEMORY_GB_HOURS', _sum: { quantity: 200 } },
        { metric: 'BANDWIDTH_GB', _sum: { quantity: 50 } },
        { metric: 'STORAGE_GB', _sum: { quantity: 100 } },
      ]);

      const result = await usageTrackingService.getAggregatedUsage({
        userId: 'user-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(result[0].cost).toBe(1.0); // 100 * 0.01
      expect(result[1].cost).toBe(1.0); // 200 * 0.005
      expect(result[2].cost).toBe(6.0); // 50 * 0.12
      expect(result[3].cost).toBe(2.3); // 100 * 0.023
    });

    it('should handle null sum values in aggregation', async () => {
      mockPrisma.service.findMany.mockResolvedValue([testServices.service1]);
      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: null } },
      ]);

      const result = await usageTrackingService.getAggregatedUsage({
        userId: 'user-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(result).toEqual([{ metric: 'COMPUTE_HOURS', quantity: 0, cost: 0 }]);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for COMPUTE_HOURS correctly', () => {
      const cost = usageTrackingService.calculateCost('COMPUTE_HOURS', 100);
      expect(cost).toBe(1.0);
    });

    it('should calculate cost for MEMORY_GB_HOURS correctly', () => {
      const cost = usageTrackingService.calculateCost('MEMORY_GB_HOURS', 200);
      expect(cost).toBe(1.0);
    });

    it('should calculate cost for BANDWIDTH_GB correctly', () => {
      const cost = usageTrackingService.calculateCost('BANDWIDTH_GB', 50);
      expect(cost).toBe(6.0);
    });

    it('should calculate cost for STORAGE_GB correctly', () => {
      const cost = usageTrackingService.calculateCost('STORAGE_GB', 100);
      expect(cost).toBe(2.3);
    });

    it('should round to 2 decimal places', () => {
      const cost = usageTrackingService.calculateCost('COMPUTE_HOURS', 123.456);
      expect(cost).toBe(1.23);
    });

    it('should handle zero quantity', () => {
      const cost = usageTrackingService.calculateCost('COMPUTE_HOURS', 0);
      expect(cost).toBe(0);
    });

    it('should handle fractional quantities', () => {
      const cost = usageTrackingService.calculateCost('BANDWIDTH_GB', 0.5);
      expect(cost).toBe(0.06);
    });

    it('should match expected pricing constants', () => {
      Object.entries(usagePricing).forEach(([metric, pricePerUnit]) => {
        const quantity = 100;
        const cost = usageTrackingService.calculateCost(metric as UsageMetric, quantity);
        const expectedCost = Math.round(pricePerUnit * quantity * 100) / 100;
        expect(cost).toBe(expectedCost);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very large quantities', async () => {
      mockPrisma.usageRecord.create.mockResolvedValue({});

      await usageTrackingService.recordUsage({
        serviceId: 'service-1',
        metric: 'COMPUTE_HOURS',
        quantity: 1000000,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      expect(mockPrisma.usageRecord.create).toHaveBeenCalled();
    });

    it('should handle very small quantities', async () => {
      mockPrisma.usageRecord.create.mockResolvedValue({});

      await usageTrackingService.recordUsage({
        serviceId: 'service-1',
        metric: 'COMPUTE_HOURS',
        quantity: 0.001,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
      });

      const call = mockPrisma.usageRecord.create.mock.calls[0][0];
      expect(call.data.quantity).toBe(0.001);
    });

    it('should handle period spanning multiple months', async () => {
      mockPrisma.usageRecord.groupBy.mockResolvedValue([]);

      await usageTrackingService.getServiceUsage({
        serviceId: 'service-1',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-06-30'),
      });

      expect(mockPrisma.usageRecord.groupBy).toHaveBeenCalled();
    });

    it('should handle same-day period', async () => {
      mockPrisma.usageRecord.groupBy.mockResolvedValue([]);

      const sameDay = new Date('2024-01-15T12:00:00Z');

      await usageTrackingService.getServiceUsage({
        serviceId: 'service-1',
        periodStart: sameDay,
        periodEnd: sameDay,
      });

      expect(mockPrisma.usageRecord.groupBy).toHaveBeenCalled();
    });

    it('should calculate cost with precision for small amounts', () => {
      // Test precision at 2 decimal places
      const cost1 = usageTrackingService.calculateCost('COMPUTE_HOURS', 1);
      expect(cost1).toBe(0.01);

      const cost2 = usageTrackingService.calculateCost('MEMORY_GB_HOURS', 1);
      expect(cost2).toBe(0.01); // MEMORY_GB_HOURS rate is 0.005, which rounds to 0.01 at 2 decimal places
    });
  });
});
