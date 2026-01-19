import { UsageMetric } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageTrackingService } from './UsageTrackingService.js';

describe('UsageTrackingService', () => {
  let service: UsageTrackingService;
  let mockPrisma: any;

  const mockService = {
    id: 'service-1',
    userId: 'user-1',
  };

  const mockService2 = {
    id: 'service-2',
    userId: 'user-1',
  };

  beforeEach(() => {
    mockPrisma = {
      usageRecord: {
        create: vi.fn(),
        groupBy: vi.fn(),
      },
      service: {
        findMany: vi.fn(),
      },
    };

    service = new UsageTrackingService(mockPrisma);
  });

  describe('recordUsage', () => {
    it('should successfully record usage for a service', async () => {
      const params = {
        serviceId: 'service-1',
        metric: UsageMetric.COMPUTE_HOURS,
        quantity: 10.5,
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-01T01:00:00Z'),
      };

      mockPrisma.usageRecord.create.mockResolvedValue({
        id: 'usage-1',
        ...params,
        timestamp: expect.any(Date),
      });

      await service.recordUsage(params);

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: {
          serviceId: params.serviceId,
          metric: params.metric,
          quantity: params.quantity,
          timestamp: expect.any(Date),
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
        },
      });
    });

    it('should record usage for MEMORY_GB_HOURS metric', async () => {
      const params = {
        serviceId: 'service-1',
        metric: UsageMetric.MEMORY_GB_HOURS,
        quantity: 5.25,
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-01T01:00:00Z'),
      };

      mockPrisma.usageRecord.create.mockResolvedValue({ id: 'usage-2' });

      await service.recordUsage(params);

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metric: UsageMetric.MEMORY_GB_HOURS,
          quantity: 5.25,
        }),
      });
    });

    it('should record usage for BANDWIDTH_GB metric', async () => {
      const params = {
        serviceId: 'service-1',
        metric: UsageMetric.BANDWIDTH_GB,
        quantity: 100.0,
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-02T00:00:00Z'),
      };

      mockPrisma.usageRecord.create.mockResolvedValue({ id: 'usage-3' });

      await service.recordUsage(params);

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metric: UsageMetric.BANDWIDTH_GB,
          quantity: 100.0,
        }),
      });
    });

    it('should record usage for STORAGE_GB metric', async () => {
      const params = {
        serviceId: 'service-1',
        metric: UsageMetric.STORAGE_GB,
        quantity: 50.5,
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-02-01T00:00:00Z'),
      };

      mockPrisma.usageRecord.create.mockResolvedValue({ id: 'usage-4' });

      await service.recordUsage(params);

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metric: UsageMetric.STORAGE_GB,
          quantity: 50.5,
        }),
      });
    });

    it('should handle zero quantity', async () => {
      const params = {
        serviceId: 'service-1',
        metric: UsageMetric.COMPUTE_HOURS,
        quantity: 0,
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-01T01:00:00Z'),
      };

      mockPrisma.usageRecord.create.mockResolvedValue({ id: 'usage-5' });

      await service.recordUsage(params);

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quantity: 0,
        }),
      });
    });

    it('should handle large quantities', async () => {
      const params = {
        serviceId: 'service-1',
        metric: UsageMetric.BANDWIDTH_GB,
        quantity: 999999.99,
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.usageRecord.create.mockResolvedValue({ id: 'usage-6' });

      await service.recordUsage(params);

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quantity: 999999.99,
        }),
      });
    });

    it('should throw error when database operation fails', async () => {
      const params = {
        serviceId: 'service-1',
        metric: UsageMetric.COMPUTE_HOURS,
        quantity: 10,
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-01T01:00:00Z'),
      };

      const dbError = new Error('Database connection failed');
      mockPrisma.usageRecord.create.mockRejectedValue(dbError);

      await expect(service.recordUsage(params)).rejects.toThrow('Database connection failed');
    });
  });

  describe('getServiceUsage', () => {
    it('should retrieve usage for a service in a period', async () => {
      const params = {
        serviceId: 'service-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      const mockGroupByResult = [
        {
          metric: UsageMetric.COMPUTE_HOURS,
          _sum: { quantity: 100.5 },
        },
        {
          metric: UsageMetric.MEMORY_GB_HOURS,
          _sum: { quantity: 50.25 },
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getServiceUsage(params);

      expect(result).toEqual([
        { metric: UsageMetric.COMPUTE_HOURS, quantity: 100.5 },
        { metric: UsageMetric.MEMORY_GB_HOURS, quantity: 50.25 },
      ]);

      expect(mockPrisma.usageRecord.groupBy).toHaveBeenCalledWith({
        by: ['metric'],
        where: {
          serviceId: params.serviceId,
          periodStart: { gte: params.periodStart },
          periodEnd: { lte: params.periodEnd },
        },
        _sum: { quantity: true },
      });
    });

    it('should handle multiple records of the same metric (aggregation)', async () => {
      const params = {
        serviceId: 'service-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      const mockGroupByResult = [
        {
          metric: UsageMetric.COMPUTE_HOURS,
          _sum: { quantity: 250.75 }, // Aggregated from multiple records
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getServiceUsage(params);

      expect(result).toEqual([{ metric: UsageMetric.COMPUTE_HOURS, quantity: 250.75 }]);
    });

    it('should return empty array when no records exist', async () => {
      const params = {
        serviceId: 'service-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.usageRecord.groupBy.mockResolvedValue([]);

      const result = await service.getServiceUsage(params);

      expect(result).toEqual([]);
    });

    it('should handle null quantity sum', async () => {
      const params = {
        serviceId: 'service-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      const mockGroupByResult = [
        {
          metric: UsageMetric.COMPUTE_HOURS,
          _sum: { quantity: null },
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getServiceUsage(params);

      expect(result).toEqual([{ metric: UsageMetric.COMPUTE_HOURS, quantity: 0 }]);
    });

    it('should properly filter by date range', async () => {
      const params = {
        serviceId: 'service-1',
        periodStart: new Date('2024-01-15T00:00:00Z'),
        periodEnd: new Date('2024-01-20T23:59:59Z'),
      };

      mockPrisma.usageRecord.groupBy.mockResolvedValue([]);

      await service.getServiceUsage(params);

      expect(mockPrisma.usageRecord.groupBy).toHaveBeenCalledWith({
        by: ['metric'],
        where: {
          serviceId: params.serviceId,
          periodStart: { gte: params.periodStart },
          periodEnd: { lte: params.periodEnd },
        },
        _sum: { quantity: true },
      });
    });

    it('should throw error when database operation fails', async () => {
      const params = {
        serviceId: 'service-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      const dbError = new Error('Database query failed');
      mockPrisma.usageRecord.groupBy.mockRejectedValue(dbError);

      await expect(service.getServiceUsage(params)).rejects.toThrow('Database query failed');
    });
  });

  describe('getAggregatedUsage', () => {
    it('should aggregate usage by userId', async () => {
      const params = {
        userId: 'user-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService, mockService2]);

      const mockGroupByResult = [
        {
          metric: UsageMetric.COMPUTE_HOURS,
          _sum: { quantity: 200.0 },
        },
        {
          metric: UsageMetric.MEMORY_GB_HOURS,
          _sum: { quantity: 100.0 },
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getAggregatedUsage(params);

      expect(result).toEqual([
        {
          metric: UsageMetric.COMPUTE_HOURS,
          quantity: 200.0,
          cost: 2.0, // 200 * 0.01
        },
        {
          metric: UsageMetric.MEMORY_GB_HOURS,
          quantity: 100.0,
          cost: 0.5, // 100 * 0.005
        },
      ]);

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          userId: params.userId,
          environment: undefined,
        },
        select: { id: true },
      });

      expect(mockPrisma.usageRecord.groupBy).toHaveBeenCalledWith({
        by: ['metric'],
        where: {
          serviceId: { in: ['service-1', 'service-2'] },
          periodStart: { gte: params.periodStart },
          periodEnd: { lte: params.periodEnd },
        },
        _sum: { quantity: true },
      });
    });

    it('should aggregate usage by organizationId', async () => {
      const params = {
        organizationId: 'org-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService]);

      const mockGroupByResult = [
        {
          metric: UsageMetric.BANDWIDTH_GB,
          _sum: { quantity: 500.0 },
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getAggregatedUsage(params);

      expect(result).toEqual([
        {
          metric: UsageMetric.BANDWIDTH_GB,
          quantity: 500.0,
          cost: 60.0, // 500 * 0.12
        },
      ]);

      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          environment: {
            project: {
              organizationId: 'org-1',
            },
          },
        },
        select: { id: true },
      });
    });

    it('should return empty array when no services exist', async () => {
      const params = {
        userId: 'user-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.service.findMany.mockResolvedValue([]);

      const result = await service.getAggregatedUsage(params);

      expect(result).toEqual([]);
      expect(mockPrisma.usageRecord.groupBy).not.toHaveBeenCalled();
    });

    it('should handle multiple services with aggregated usage', async () => {
      const params = {
        userId: 'user-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      const mockServices = [{ id: 'service-1' }, { id: 'service-2' }, { id: 'service-3' }];

      mockPrisma.service.findMany.mockResolvedValue(mockServices);

      const mockGroupByResult = [
        {
          metric: UsageMetric.COMPUTE_HOURS,
          _sum: { quantity: 500.0 },
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getAggregatedUsage(params);

      expect(result).toEqual([
        {
          metric: UsageMetric.COMPUTE_HOURS,
          quantity: 500.0,
          cost: 5.0,
        },
      ]);

      expect(mockPrisma.usageRecord.groupBy).toHaveBeenCalledWith({
        by: ['metric'],
        where: {
          serviceId: { in: ['service-1', 'service-2', 'service-3'] },
          periodStart: { gte: params.periodStart },
          periodEnd: { lte: params.periodEnd },
        },
        _sum: { quantity: true },
      });
    });

    it('should handle null quantity sum', async () => {
      const params = {
        userId: 'user-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService]);

      const mockGroupByResult = [
        {
          metric: UsageMetric.COMPUTE_HOURS,
          _sum: { quantity: null },
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getAggregatedUsage(params);

      expect(result).toEqual([
        {
          metric: UsageMetric.COMPUTE_HOURS,
          quantity: 0,
          cost: 0,
        },
      ]);
    });

    it('should correctly integrate cost calculation', async () => {
      const params = {
        userId: 'user-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService]);

      const mockGroupByResult = [
        {
          metric: UsageMetric.STORAGE_GB,
          _sum: { quantity: 100.0 },
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getAggregatedUsage(params);

      expect(result).toEqual([
        {
          metric: UsageMetric.STORAGE_GB,
          quantity: 100.0,
          cost: 2.3, // 100 * 0.023
        },
      ]);
    });

    it('should throw error when service query fails', async () => {
      const params = {
        userId: 'user-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      const dbError = new Error('Failed to query services');
      mockPrisma.service.findMany.mockRejectedValue(dbError);

      await expect(service.getAggregatedUsage(params)).rejects.toThrow('Failed to query services');
    });

    it('should throw error when usage aggregation fails', async () => {
      const params = {
        userId: 'user-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService]);

      const dbError = new Error('Failed to aggregate usage');
      mockPrisma.usageRecord.groupBy.mockRejectedValue(dbError);

      await expect(service.getAggregatedUsage(params)).rejects.toThrow('Failed to aggregate usage');
    });

    it('should handle both userId and organizationId provided simultaneously', async () => {
      const params = {
        userId: 'user-1',
        organizationId: 'org-1',
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService]);

      const mockGroupByResult = [
        {
          metric: UsageMetric.COMPUTE_HOURS,
          _sum: { quantity: 100.0 },
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getAggregatedUsage(params);

      expect(result).toEqual([
        {
          metric: UsageMetric.COMPUTE_HOURS,
          quantity: 100.0,
          cost: 1.0,
        },
      ]);

      // Verify that both userId and organizationId are used in the query
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          userId: params.userId,
          environment: {
            project: {
              organizationId: params.organizationId,
            },
          },
        },
        select: { id: true },
      });
    });

    it('should query all services when neither userId nor organizationId provided', async () => {
      const params = {
        periodStart: new Date('2024-01-01T00:00:00Z'),
        periodEnd: new Date('2024-01-31T23:59:59Z'),
      };

      mockPrisma.service.findMany.mockResolvedValue([mockService, mockService2]);

      const mockGroupByResult = [
        {
          metric: UsageMetric.COMPUTE_HOURS,
          _sum: { quantity: 300.0 },
        },
      ];

      mockPrisma.usageRecord.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.getAggregatedUsage(params);

      expect(result).toEqual([
        {
          metric: UsageMetric.COMPUTE_HOURS,
          quantity: 300.0,
          cost: 3.0,
        },
      ]);

      // Verify that no user or organization filter is applied
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          environment: undefined,
        },
        select: { id: true },
      });
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for COMPUTE_HOURS metric', () => {
      const cost = service.calculateCost(UsageMetric.COMPUTE_HOURS, 100);
      expect(cost).toBe(1.0); // 100 * 0.01
    });

    it('should calculate cost for MEMORY_GB_HOURS metric', () => {
      const cost = service.calculateCost(UsageMetric.MEMORY_GB_HOURS, 200);
      expect(cost).toBe(1.0); // 200 * 0.005
    });

    it('should calculate cost for BANDWIDTH_GB metric', () => {
      const cost = service.calculateCost(UsageMetric.BANDWIDTH_GB, 100);
      expect(cost).toBe(12.0); // 100 * 0.12
    });

    it('should calculate cost for STORAGE_GB metric', () => {
      const cost = service.calculateCost(UsageMetric.STORAGE_GB, 1000);
      expect(cost).toBe(23.0); // 1000 * 0.023
    });

    it('should round to 2 decimal places', () => {
      const cost = service.calculateCost(UsageMetric.COMPUTE_HOURS, 123.456);
      expect(cost).toBe(1.23); // 123.456 * 0.01 = 1.23456 -> 1.23
    });

    it('should handle zero quantity', () => {
      const cost = service.calculateCost(UsageMetric.COMPUTE_HOURS, 0);
      expect(cost).toBe(0);
    });

    it('should handle fractional quantities', () => {
      const cost = service.calculateCost(UsageMetric.MEMORY_GB_HOURS, 10.5);
      expect(cost).toBe(0.05); // 10.5 * 0.005 = 0.0525 -> 0.05
    });

    it('should handle large quantities', () => {
      const cost = service.calculateCost(UsageMetric.BANDWIDTH_GB, 10000);
      expect(cost).toBe(1200.0); // 10000 * 0.12
    });

    it('should round down correctly', () => {
      const cost = service.calculateCost(UsageMetric.COMPUTE_HOURS, 12.344);
      expect(cost).toBe(0.12); // 12.344 * 0.01 = 0.12344 -> 0.12
    });

    it('should round down correctly for midpoint values', () => {
      const cost = service.calculateCost(UsageMetric.COMPUTE_HOURS, 12.355);
      expect(cost).toBe(0.12); // 12.355 * 0.01 = 0.12355 -> 0.12 (rounds down)
    });

    it('should handle very small fractional costs', () => {
      const cost = service.calculateCost(UsageMetric.MEMORY_GB_HOURS, 0.1);
      expect(cost).toBe(0.0); // 0.1 * 0.005 = 0.0005 -> 0.00
    });
  });
});
