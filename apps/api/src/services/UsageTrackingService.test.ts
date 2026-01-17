import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageTrackingService } from './UsageTrackingService';
import {
  billingScenarios,
  calculateUsageCost,
  createUsageRecordFixture,
} from '../test/fixtures/billing.fixtures';

// Mock Prisma
const mockPrisma = {
  usageRecord: {
    create: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  service: {
    findMany: vi.fn(),
  },
};

vi.mock('database', () => ({
  prisma: mockPrisma,
  PrismaClient: vi.fn(),
}));

describe('UsageTrackingService', () => {
  let usageTrackingService: UsageTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    usageTrackingService = new UsageTrackingService(mockPrisma as any);
  });

  describe('recordUsage', () => {
    it('should record usage for a service', async () => {
      mockPrisma.usageRecord.create.mockResolvedValue({});

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      await usageTrackingService.recordUsage({
        serviceId: 'service-123',
        metric: 'COMPUTE_HOURS',
        quantity: 100,
        periodStart,
        periodEnd,
      });

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: {
          serviceId: 'service-123',
          metric: 'COMPUTE_HOURS',
          quantity: 100,
          timestamp: expect.any(Date),
          periodStart,
          periodEnd,
        },
      });
    });

    it('should record different usage metrics', async () => {
      mockPrisma.usageRecord.create.mockResolvedValue({});
      const periodStart = new Date();
      const periodEnd = new Date();

      // Test each metric type
      const metrics: Array<{ metric: any; quantity: number }> = [
        { metric: 'COMPUTE_HOURS', quantity: 50 },
        { metric: 'MEMORY_GB_HOURS', quantity: 25 },
        { metric: 'BANDWIDTH_GB', quantity: 10 },
        { metric: 'STORAGE_GB', quantity: 5 },
      ];

      for (const { metric, quantity } of metrics) {
        await usageTrackingService.recordUsage({
          serviceId: 'service-456',
          metric,
          quantity,
          periodStart,
          periodEnd,
        });
      }

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledTimes(4);
    });
  });

  describe('getServiceUsage', () => {
    it('should get usage for a service in a period', async () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: 100 } },
        { metric: 'MEMORY_GB_HOURS', _sum: { quantity: 50 } },
      ]);

      const usage = await usageTrackingService.getServiceUsage({
        serviceId: 'service-123',
        periodStart,
        periodEnd,
      });

      expect(usage).toEqual([
        { metric: 'COMPUTE_HOURS', quantity: 100 },
        { metric: 'MEMORY_GB_HOURS', quantity: 50 },
      ]);

      expect(mockPrisma.usageRecord.groupBy).toHaveBeenCalledWith({
        by: ['metric'],
        where: {
          serviceId: 'service-123',
          periodStart: { gte: periodStart },
          periodEnd: { lte: periodEnd },
        },
        _sum: { quantity: true },
      });
    });

    it('should return empty array if no usage found', async () => {
      mockPrisma.usageRecord.groupBy.mockResolvedValue([]);

      const usage = await usageTrackingService.getServiceUsage({
        serviceId: 'service-nonexistent',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(usage).toEqual([]);
    });

    it('should handle null sum values', async () => {
      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: null } },
      ]);

      const usage = await usageTrackingService.getServiceUsage({
        serviceId: 'service-789',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(usage).toEqual([{ metric: 'COMPUTE_HOURS', quantity: 0 }]);
    });
  });

  describe('getAggregatedUsage', () => {
    it('should get aggregated usage for a user', async () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');
      const scenario = billingScenarios.starterWithUsage;

      // Mock services
      mockPrisma.service.findMany.mockResolvedValue(scenario.services);

      // Mock usage records
      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: 100 } },
        { metric: 'MEMORY_GB_HOURS', _sum: { quantity: 50 } },
        { metric: 'BANDWIDTH_GB', _sum: { quantity: 25 } },
        { metric: 'STORAGE_GB', _sum: { quantity: 10 } },
      ]);

      const usage = await usageTrackingService.getAggregatedUsage({
        userId: scenario.user.id,
        periodStart,
        periodEnd,
      });

      // Calculate expected costs
      const expectedCost = calculateUsageCost(
        [
          { metric: 'COMPUTE_HOURS', quantity: 100 },
          { metric: 'MEMORY_GB_HOURS', quantity: 50 },
          { metric: 'BANDWIDTH_GB', quantity: 25 },
          { metric: 'STORAGE_GB', quantity: 10 },
        ],
        'STARTER',
      );

      expect(usage).toHaveLength(4);
      expect(usage[0]).toMatchObject({
        metric: 'COMPUTE_HOURS',
        quantity: 100,
        cost: expect.any(Number),
      });

      // Verify total cost calculation
      const totalCost = usage.reduce((sum, record) => sum + record.cost, 0);
      expect(totalCost).toBeCloseTo(expectedCost, 2);
    });

    it('should get aggregated usage for an organization', async () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');
      const orgId = 'org-123';

      mockPrisma.service.findMany.mockResolvedValue([
        { id: 'service-1', userId: 'user-1', environment: { projectId: 'proj-1' } },
      ]);

      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: 200 } },
      ]);

      const usage = await usageTrackingService.getAggregatedUsage({
        organizationId: orgId,
        periodStart,
        periodEnd,
      });

      expect(usage).toBeDefined();
      expect(mockPrisma.service.findMany).toHaveBeenCalled();
    });

    it('should return empty array if no services found', async () => {
      mockPrisma.service.findMany.mockResolvedValue([]);

      const usage = await usageTrackingService.getAggregatedUsage({
        userId: 'user-no-services',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
      });

      expect(usage).toEqual([]);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for compute hours', async () => {
      const usage = createUsageRecordFixture({
        serviceId: 'service-123',
        metric: 'COMPUTE_HOURS',
        quantity: 100,
      });

      const cost = await usageTrackingService.calculateCost(
        usage.metric,
        usage.quantity,
      );

      // $0.01 per compute hour
      expect(cost).toBe(1.0);
    });

    it('should calculate cost correctly for memory', async () => {
      const usage = createUsageRecordFixture({
        serviceId: 'service-123',
        metric: 'MEMORY_GB_HOURS',
        quantity: 100,
      });

      const cost = await usageTrackingService.calculateCost(
        usage.metric,
        usage.quantity,
      );

      // $0.005 per GB-hour
      expect(cost).toBe(0.5);
    });

    it('should calculate cost correctly for bandwidth', async () => {
      const usage = createUsageRecordFixture({
        serviceId: 'service-123',
        metric: 'BANDWIDTH_GB',
        quantity: 50,
      });

      const cost = await usageTrackingService.calculateCost(
        usage.metric,
        usage.quantity,
      );

      // $0.12 per GB
      expect(cost).toBe(6.0);
    });

    it('should calculate cost correctly for storage', async () => {
      const usage = createUsageRecordFixture({
        serviceId: 'service-123',
        metric: 'STORAGE_GB',
        quantity: 100,
      });

      const cost = await usageTrackingService.calculateCost(
        usage.metric,
        usage.quantity,
      );

      // $0.023 per GB
      expect(cost).toBe(2.3);
    });

    it('should handle zero quantity', async () => {
      const cost = await usageTrackingService.calculateCost('COMPUTE_HOURS', 0);

      expect(cost).toBe(0);
    });
  });

  describe('getUsageForPeriod', () => {
    it('should get all usage records for a service in a period', async () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');
      const scenario = billingScenarios.starterWithUsage;

      mockPrisma.usageRecord.findMany.mockResolvedValue(scenario.usage);

      const records = await usageTrackingService.getUsageForPeriod({
        serviceId: scenario.services[0].id,
        periodStart,
        periodEnd,
      });

      expect(records).toHaveLength(scenario.usage.length);
      expect(mockPrisma.usageRecord.findMany).toHaveBeenCalledWith({
        where: {
          serviceId: scenario.services[0].id,
          periodStart: { gte: periodStart },
          periodEnd: { lte: periodEnd },
        },
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  describe('getTotalUsageByMetric', () => {
    it('should calculate total usage by metric type', async () => {
      const scenario = billingScenarios.proWithMultipleServices;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      // Mock services
      mockPrisma.service.findMany.mockResolvedValue(scenario.services);

      // Mock usage grouped by metric
      mockPrisma.usageRecord.groupBy.mockResolvedValue([
        { metric: 'COMPUTE_HOURS', _sum: { quantity: 650 } }, // 200 + 150 + 300
        { metric: 'MEMORY_GB_HOURS', _sum: { quantity: 300 } }, // 100 + 200
        { metric: 'BANDWIDTH_GB', _sum: { quantity: 100 } },
      ]);

      const totals = await usageTrackingService.getTotalUsageByMetric({
        userId: scenario.user.id,
        periodStart,
        periodEnd,
      });

      expect(totals).toContainEqual({
        metric: 'COMPUTE_HOURS',
        quantity: 650,
      });
      expect(totals).toContainEqual({
        metric: 'MEMORY_GB_HOURS',
        quantity: 300,
      });
    });
  });
});
