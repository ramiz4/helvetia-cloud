import { PrismaClient, UsageMetric } from 'database';
import Docker from 'dockerode';
import type IORedis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageCollectionService } from './usageCollection.service';

// Mock logger
vi.mock('shared', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ioredis
vi.mock('ioredis', () => {
  const mockRedis = vi.fn().mockImplementation(function (this: any) {
    this.get = vi.fn().mockResolvedValue(null);
    this.setex = vi.fn().mockResolvedValue('OK');
    this.quit = vi.fn().mockResolvedValue('OK');
    return this;
  });
  return { default: mockRedis };
});

describe('UsageCollectionService', () => {
  let service: UsageCollectionService;
  let mockDocker: Docker;
  let mockPrisma: PrismaClient;
  let mockRedis: IORedis;

  beforeEach(() => {
    mockDocker = {} as Docker;
    mockPrisma = {
      usageRecord: {
        createMany: vi.fn(),
      },
    } as unknown as PrismaClient;

    // Create mock Redis instance
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      quit: vi.fn().mockResolvedValue('OK'),
    } as unknown as IORedis;

    service = new UsageCollectionService(mockDocker, mockPrisma, 'redis://localhost:6379');
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await service.cleanup();
  });

  describe('collectAllMetrics', () => {
    it('should collect metrics from running containers with helvetia.serviceId label', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Labels: { 'helvetia.serviceId': 'service1' },
          State: 'running',
        },
        {
          Id: 'container2',
          Labels: { 'helvetia.serviceId': 'service2' },
          State: 'running',
        },
      ];

      const mockStats = {
        cpu_stats: {
          cpu_usage: { total_usage: 2000000 },
          system_cpu_usage: 10000000,
          online_cpus: 2,
        },
        precpu_stats: {
          cpu_usage: { total_usage: 1000000 },
          system_cpu_usage: 5000000,
        },
        memory_stats: {
          usage: 536870912, // 512MB
          limit: 1073741824, // 1GB
          stats: { cache: 0 },
        },
        networks: {
          eth0: {
            rx_bytes: 1024 * 1024, // 1MB
            tx_bytes: 2 * 1024 * 1024, // 2MB
          },
        },
        blkio_stats: {
          io_service_bytes_recursive: [
            { op: 'Read', value: 5 * 1024 * 1024 }, // 5MB
            { op: 'Write', value: 10 * 1024 * 1024 }, // 10MB
          ],
        },
      };

      mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = vi.fn().mockImplementation(() => ({
        stats: vi.fn().mockResolvedValue(mockStats),
      }));

      const metrics = await service.collectAllMetrics();

      expect(metrics).toHaveLength(2);
      expect(metrics[0]).toMatchObject({
        containerId: 'container1',
        serviceId: 'service1',
      });
      expect(metrics[0].cpuPercent).toBeGreaterThan(0);
      expect(metrics[0].memoryMB).toBeGreaterThan(0);
    });

    it('should skip containers without helvetia.serviceId label', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Labels: {}, // No serviceId
          State: 'running',
        },
      ];

      mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);

      const metrics = await service.collectAllMetrics();

      expect(metrics).toHaveLength(0);
    });

    it('should handle container stats errors gracefully', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Labels: { 'helvetia.serviceId': 'service1' },
          State: 'running',
        },
      ];

      mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = vi.fn().mockImplementation(() => ({
        stats: vi.fn().mockRejectedValue(new Error('Container not found')),
      }));

      const metrics = await service.collectAllMetrics();

      expect(metrics).toHaveLength(0);
    });
  });

  describe('calculateUsage', () => {
    it('should calculate usage for a 10-minute interval with delta tracking', async () => {
      const metrics = [
        {
          containerId: 'container1',
          serviceId: 'service1',
          cpuPercent: 50,
          memoryMB: 512,
          memoryLimitMB: 1024,
          networkRxBytes: 10 * 1024 * 1024 * 1024, // 10GB
          networkTxBytes: 5 * 1024 * 1024 * 1024, // 5GB
          blockReadBytes: 1 * 1024 * 1024 * 1024, // 1GB
          blockWriteBytes: 2 * 1024 * 1024 * 1024, // 2GB
        },
      ];

      const usage = await service.calculateUsage(metrics, 10);

      expect(usage).toHaveLength(1);
      expect(usage[0].serviceId).toBe('service1');
      expect(usage[0].computeHours).toBeCloseTo(10 / 60, 4); // 10 minutes = 0.1667 hours
      expect(usage[0].memoryGBHours).toBeCloseTo((512 / 1024) * (10 / 60), 4); // 0.5GB * 0.1667h
      // First collection: no previous data, so bandwidth and storage should be 0
      expect(usage[0].bandwidthGB).toBe(0);
      expect(usage[0].storageGB).toBe(0);
    });

    it('should aggregate usage for multiple containers of the same service', async () => {
      const metrics = [
        {
          containerId: 'container1',
          serviceId: 'service1',
          cpuPercent: 50,
          memoryMB: 512,
          memoryLimitMB: 1024,
          networkRxBytes: 1024 * 1024 * 1024, // 1GB
          networkTxBytes: 1024 * 1024 * 1024, // 1GB
          blockReadBytes: 0,
          blockWriteBytes: 0,
        },
        {
          containerId: 'container2',
          serviceId: 'service1',
          cpuPercent: 30,
          memoryMB: 256,
          memoryLimitMB: 512,
          networkRxBytes: 1024 * 1024 * 1024, // 1GB
          networkTxBytes: 1024 * 1024 * 1024, // 1GB
          blockReadBytes: 0,
          blockWriteBytes: 0,
        },
      ];

      const usage = await service.calculateUsage(metrics, 10);

      expect(usage).toHaveLength(1);
      expect(usage[0].computeHours).toBeCloseTo((10 / 60) * 2, 4); // 2 containers
      expect(usage[0].memoryGBHours).toBeCloseTo(((512 + 256) / 1024) * (10 / 60), 4);
    });

    it('should handle multiple services separately', async () => {
      const metrics = [
        {
          containerId: 'container1',
          serviceId: 'service1',
          cpuPercent: 50,
          memoryMB: 512,
          memoryLimitMB: 1024,
          networkRxBytes: 1024 * 1024 * 1024,
          networkTxBytes: 1024 * 1024 * 1024,
          blockReadBytes: 0,
          blockWriteBytes: 0,
        },
        {
          containerId: 'container2',
          serviceId: 'service2',
          cpuPercent: 30,
          memoryMB: 256,
          memoryLimitMB: 512,
          networkRxBytes: 1024 * 1024 * 1024,
          networkTxBytes: 1024 * 1024 * 1024,
          blockReadBytes: 0,
          blockWriteBytes: 0,
        },
      ];

      const usage = await service.calculateUsage(metrics, 10);

      expect(usage).toHaveLength(2);
      expect(usage.find((u) => u.serviceId === 'service1')).toBeDefined();
      expect(usage.find((u) => u.serviceId === 'service2')).toBeDefined();
    });
  });

  describe('recordUsage', () => {
    it('should create usage records for all metrics', async () => {
      const usage = [
        {
          serviceId: 'service1',
          computeHours: 0.5,
          memoryGBHours: 0.25,
          bandwidthGB: 10,
          storageGB: 5,
        },
      ];

      const periodStart = new Date('2024-01-01T00:00:00Z');
      const periodEnd = new Date('2024-01-01T00:10:00Z');

      await service.recordUsage(usage, periodStart, periodEnd);

      expect(mockPrisma.usageRecord.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            serviceId: 'service1',
            metric: UsageMetric.COMPUTE_HOURS,
            quantity: 0.5,
          }),
          expect.objectContaining({
            serviceId: 'service1',
            metric: UsageMetric.MEMORY_GB_HOURS,
            quantity: 0.25,
          }),
          expect.objectContaining({
            serviceId: 'service1',
            metric: UsageMetric.BANDWIDTH_GB,
            quantity: 10,
          }),
          expect.objectContaining({
            serviceId: 'service1',
            metric: UsageMetric.STORAGE_GB,
            quantity: 5,
          }),
        ]),
      });
    });

    it('should skip zero usage metrics', async () => {
      const usage = [
        {
          serviceId: 'service1',
          computeHours: 0.5,
          memoryGBHours: 0,
          bandwidthGB: 0,
          storageGB: 0,
        },
      ];

      const periodStart = new Date('2024-01-01T00:00:00Z');
      const periodEnd = new Date('2024-01-01T00:10:00Z');

      await service.recordUsage(usage, periodStart, periodEnd);

      expect(mockPrisma.usageRecord.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            metric: UsageMetric.COMPUTE_HOURS,
          }),
        ]),
      });

      const callArgs = vi.mocked(mockPrisma.usageRecord.createMany).mock.calls[0][0];
      expect(callArgs.data).toHaveLength(1); // Only compute hours
    });

    it('should not create records if no usage', async () => {
      const usage = [
        {
          serviceId: 'service1',
          computeHours: 0,
          memoryGBHours: 0,
          bandwidthGB: 0,
          storageGB: 0,
        },
      ];

      const periodStart = new Date('2024-01-01T00:00:00Z');
      const periodEnd = new Date('2024-01-01T00:10:00Z');

      await service.recordUsage(usage, periodStart, periodEnd);

      expect(mockPrisma.usageRecord.createMany).not.toHaveBeenCalled();
    });
  });

  describe('collectAndRecord', () => {
    it('should collect metrics, calculate usage, and record to database', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Labels: { 'helvetia.serviceId': 'service1' },
          State: 'running',
        },
      ];

      const mockStats = {
        cpu_stats: {
          cpu_usage: { total_usage: 2000000 },
          system_cpu_usage: 10000000,
          online_cpus: 1,
        },
        precpu_stats: {
          cpu_usage: { total_usage: 1000000 },
          system_cpu_usage: 5000000,
        },
        memory_stats: {
          usage: 536870912,
          limit: 1073741824,
          stats: { cache: 0 },
        },
        networks: {
          eth0: {
            rx_bytes: 1024 * 1024,
            tx_bytes: 1024 * 1024,
          },
        },
        blkio_stats: {
          io_service_bytes_recursive: [
            { op: 'Read', value: 1024 * 1024 },
            { op: 'Write', value: 1024 * 1024 },
          ],
        },
      };

      mockDocker.listContainers = vi.fn().mockResolvedValue(mockContainers);
      mockDocker.getContainer = vi.fn().mockImplementation(() => ({
        stats: vi.fn().mockResolvedValue(mockStats),
      }));

      const result = await service.collectAndRecord(10);

      expect(result.servicesProcessed).toBe(1);
      expect(result.recordsCreated).toBeGreaterThan(0);
      expect(mockPrisma.usageRecord.createMany).toHaveBeenCalled();
    });

    it('should return zero counts when no containers are running', async () => {
      mockDocker.listContainers = vi.fn().mockResolvedValue([]);

      const result = await service.collectAndRecord(10);

      expect(result.servicesProcessed).toBe(0);
      expect(result.recordsCreated).toBe(0);
      expect(mockPrisma.usageRecord.createMany).not.toHaveBeenCalled();
    });
  });
});
