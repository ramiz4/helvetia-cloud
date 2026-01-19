import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServiceMetrics } from './metrics.handler.js';

// Mock Dockerode types nicely
const mockStats = vi.fn();
const mockGetContainer = vi.fn();
const mockListContainers = vi.fn();

const mockDocker = {
  listContainers: mockListContainers,
  getContainer: mockGetContainer,
} as any;

describe('metrics.handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockReturnValue({
      stats: mockStats,
    });
  });

  const serviceId = 'test-service-id';

  describe('Status Determination', () => {
    it('should return NOT_RUNNING when no containers are found', async () => {
      const result = await getServiceMetrics(
        serviceId,
        mockDocker,
        [], // Empty container list
        { name: 'test', type: 'DOCKER' },
      );
      expect(result.status).toBe('NOT_RUNNING');
      expect(result.cpu).toBe(0);
      expect(result.memory).toBe(0);
    });

    it('should return DEPLOYING if serviceInfo status says DEPLOYING', async () => {
      const result = await getServiceMetrics(serviceId, mockDocker, [], {
        name: 'test',
        type: 'DOCKER',
        status: 'DEPLOYING',
      });
      expect(result.status).toBe('DEPLOYING');
    });

    it('should return RUNNING if at least one container is running', async () => {
      const containers = [
        {
          Id: 'c1',
          Labels: { 'helvetia.serviceId': serviceId },
          State: 'running',
        },
      ] as any;

      mockStats.mockResolvedValueOnce({
        cpu_stats: {},
        precpu_stats: {},
        memory_stats: { usage: 0, limit: 0, stats: {} },
      });

      const result = await getServiceMetrics(serviceId, mockDocker, containers, {
        name: 'test',
        type: 'DOCKER',
      });

      expect(result.status).toBe('RUNNING');
    });

    it('should return DEPLOYING if containers are restarting or created', async () => {
      const containers = [
        {
          Id: 'c1',
          Labels: { 'helvetia.serviceId': serviceId },
          State: 'restarting',
        },
      ] as any;

      const result = await getServiceMetrics(serviceId, mockDocker, containers, {
        name: 'test',
        type: 'DOCKER',
      });

      expect(result.status).toBe('DEPLOYING');
    });

    it('should return STOPPED if container exited with code 0', async () => {
      const containers = [
        {
          Id: 'c1',
          Labels: { 'helvetia.serviceId': serviceId },
          State: 'exited',
          Status: 'Exited (0) 5 seconds ago',
        },
      ] as any;

      const result = await getServiceMetrics(serviceId, mockDocker, containers, {
        name: 'test',
        type: 'DOCKER',
      });

      expect(result.status).toBe('STOPPED');
    });

    it('should return FAILED for other states (e.g. exited non-zero)', async () => {
      const containers = [
        {
          Id: 'c1',
          Labels: { 'helvetia.serviceId': serviceId },
          State: 'exited',
          Status: 'Exited (1) 5 seconds ago',
        },
      ] as any;

      const result = await getServiceMetrics(serviceId, mockDocker, containers, {
        name: 'test',
        type: 'DOCKER',
      });

      expect(result.status).toBe('FAILED');
    });
  });

  describe('Container Filtering', () => {
    it('should filter containers by helvetia.serviceId for standard services', async () => {
      const containers = [
        {
          Id: 'c1',
          Labels: { 'helvetia.serviceId': serviceId },
          State: 'running',
        },
        {
          Id: 'c2',
          Labels: { 'helvetia.serviceId': 'other-service' },
          State: 'running',
        },
      ] as any;

      mockStats.mockResolvedValue({
        cpu_stats: {},
        precpu_stats: {},
        memory_stats: { usage: 0, limit: 0, stats: {} },
      });

      await getServiceMetrics(serviceId, mockDocker, containers, { name: 'test', type: 'DOCKER' });

      // Should invoke stats only for the matching container
      expect(mockGetContainer).toHaveBeenCalledTimes(1);
      expect(mockGetContainer).toHaveBeenCalledWith('c1');
    });

    it('should filter containers by com.docker.compose.project for COMPOSE type', async () => {
      const serviceName = 'my-compose-project';
      const containers = [
        {
          Id: 'c1',
          Labels: { 'com.docker.compose.project': serviceName },
          State: 'running',
        },
        {
          Id: 'c2',
          Labels: { 'com.docker.compose.project': 'other-project' },
          State: 'running',
        },
      ] as any;

      mockStats.mockResolvedValue({
        cpu_stats: {},
        precpu_stats: {},
        memory_stats: { usage: 0, limit: 0, stats: {} },
      });

      await getServiceMetrics(serviceId, mockDocker, containers, {
        name: serviceName,
        type: 'COMPOSE',
      });

      expect(mockGetContainer).toHaveBeenCalledTimes(1);
      expect(mockGetContainer).toHaveBeenCalledWith('c1');
    });
  });

  describe('Metric Calculation', () => {
    it('should calculate CPU and Memory correctly', async () => {
      const containers = [
        {
          Id: 'c1',
          Labels: { 'helvetia.serviceId': serviceId },
          State: 'running',
        },
      ] as any;

      // Mock stats response based on Docker API format
      mockStats.mockResolvedValue({
        cpu_stats: {
          cpu_usage: { total_usage: 2000000000 }, // 2s
          system_cpu_usage: 5000000000, // 5s
          online_cpus: 2,
        },
        precpu_stats: {
          cpu_usage: { total_usage: 1000000000 }, // 1s
          system_cpu_usage: 2000000000, // 2s
        },
        memory_stats: {
          usage: 100 * 1024 * 1024 + 500, // 100MB + cache
          stats: {
            cache: 500,
          },
          limit: 512 * 1024 * 1024, // 512MB
        },
      });

      const result = await getServiceMetrics(serviceId, mockDocker, containers, {
        name: 'test',
        type: 'DOCKER',
      });

      // CPU Calculation:
      // Delta CPU = 1s
      // Delta System = 3s
      // (1 / 3) * 2 * 100 = 66.666... -> 66.67
      expect(result.cpu).toBe(66.67);

      // Memory Calculation:
      // (Usage - Cache) / 1024 / 1024
      // 100MB
      expect(result.memory).toBe(100);
      expect(result.memoryLimit).toBe(512);
    });

    it('should handle zero system delta to avoid division by zero (or negative)', async () => {
      const containers = [
        { Id: 'c1', Labels: { 'helvetia.serviceId': serviceId }, State: 'running' },
      ] as any;

      mockStats.mockResolvedValue({
        cpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 100, online_cpus: 1 },
        precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 100 },
        memory_stats: { usage: 0, limit: 0, stats: {} },
      });

      const result = await getServiceMetrics(serviceId, mockDocker, containers, {
        name: 'test',
        type: 'DOCKER',
      });
      expect(result.cpu).toBe(0);
    });

    it('should aggregate metrics from multiple containers', async () => {
      const containers = [
        { Id: 'c1', Labels: { 'helvetia.serviceId': serviceId }, State: 'running' },
        { Id: 'c2', Labels: { 'helvetia.serviceId': serviceId }, State: 'running' },
      ] as any;

      // Mock slightly different stats for each container
      mockGetContainer.mockImplementation((id) => ({
        stats: vi.fn().mockResolvedValue({
          cpu_stats: {
            cpu_usage: { total_usage: id === 'c1' ? 200 : 300 },
            system_cpu_usage: 1000,
            online_cpus: 1,
          },
          precpu_stats: {
            cpu_usage: { total_usage: 100 },
            system_cpu_usage: 900,
          },
          memory_stats: {
            usage: (id === 'c1' ? 10 : 20) * 1024 * 1024,
            limit: 100 * 1024 * 1024,
            stats: {},
          },
        }),
      }));

      // c1 CPU: delta=100, sysDelta=100 -> 100%
      // c2 CPU: delta=200, sysDelta=100 -> 200%
      // Note: the calculation in the handler is slightly different depending on inputs,
      // but assuming straightforward deltas:
      // Handler Code:
      // cpuDelta = current - pre
      // systemDelta = currentSystem - preSystem
      // totalCpu += (cpuDelta / systemDelta) * onlineCpus * 100.0

      // c1: (100 / 100) * 1 * 100 = 100
      // c2: (200 / 100) * 1 * 100 = 200
      // Total CPU = 300

      // Memory: 10 + 20 = 30

      const result = await getServiceMetrics(serviceId, mockDocker, containers, {
        name: 'test',
        type: 'DOCKER',
      });
      expect(result.cpu).toBe(300);
      expect(result.memory).toBe(30);
      expect(result.memoryLimit).toBe(200); // 100 + 100
    });

    it('should ignore containers that fail to return stats', async () => {
      const containers = [
        { Id: 'c1', Labels: { 'helvetia.serviceId': serviceId }, State: 'running' },
      ] as any;

      mockStats.mockRejectedValue(new Error('Stats failed'));

      const result = await getServiceMetrics(serviceId, mockDocker, containers, {
        name: 'test',
        type: 'DOCKER',
      });

      // Should not crash, just return 0s
      expect(result.cpu).toBe(0);
      expect(result.memory).toBe(0);
      expect(result.status).toBe('RUNNING'); // Status logic checks container list, not stats success
    });
  });
});
