import Docker from 'dockerode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthChecker } from './HealthChecker';

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;
  let mockDocker: any;

  beforeEach(() => {
    mockDocker = {} as Docker;
    healthChecker = new HealthChecker(mockDocker);
  });

  describe('isContainerHealthy', () => {
    it('should return healthy for running container without health check', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true, Status: 'running', Health: undefined },
        }),
      };

      const result = await healthChecker.isContainerHealthy(mockContainer as any);

      expect(result).toEqual({
        healthy: true,
        status: 'running (no health check)',
      });
    });

    it('should return unhealthy for stopped container', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: false, Status: 'exited' },
        }),
      };

      const result = await healthChecker.isContainerHealthy(mockContainer as any);

      expect(result).toEqual({
        healthy: false,
        status: 'exited',
      });
    });

    it('should return healthy for container with healthy status', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Running: true,
            Status: 'running',
            Health: {
              Status: 'healthy',
              Log: [{ ExitCode: 0, Output: 'OK' }],
            },
          },
        }),
      };

      const result = await healthChecker.isContainerHealthy(mockContainer as any);

      expect(result).toEqual({
        healthy: true,
        status: 'healthy',
        exitCode: 0,
        output: 'OK',
      });
    });

    it('should return unhealthy for container with unhealthy status', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Running: true,
            Status: 'running',
            Health: {
              Status: 'unhealthy',
              Log: [{ ExitCode: 1, Output: 'Failed' }],
            },
          },
        }),
      };

      const result = await healthChecker.isContainerHealthy(mockContainer as any);

      expect(result).toEqual({
        healthy: false,
        status: 'unhealthy',
        exitCode: 1,
        output: 'Failed',
      });
    });

    it('should handle errors gracefully', async () => {
      const mockContainer = {
        inspect: vi.fn().mockRejectedValue(new Error('Container not found')),
      };

      const result = await healthChecker.isContainerHealthy(mockContainer as any);

      expect(result).toEqual({
        healthy: false,
        status: 'error',
        output: 'Container not found',
      });
    });
  });

  describe('waitForHealthy', () => {
    it('should return true if container becomes healthy', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Running: true,
            Status: 'running',
            Health: { Status: 'healthy' },
          },
        }),
      };

      const result = await healthChecker.waitForHealthy(mockContainer as any, {
        timeout: 5000,
        interval: 100,
      });

      expect(result).toBe(true);
    });

    it('should return false if timeout is reached', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Running: true,
            Status: 'running',
            Health: { Status: 'starting' },
          },
        }),
      };

      const result = await healthChecker.waitForHealthy(mockContainer as any, {
        timeout: 100,
        interval: 50,
      });

      expect(result).toBe(false);
    });

    it('should use default timeout and interval', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Running: true,
            Status: 'running',
            Health: { Status: 'healthy' },
          },
        }),
      };

      const result = await healthChecker.waitForHealthy(mockContainer as any);

      expect(result).toBe(true);
    });
  });

  describe('areAllHealthy', () => {
    it('should return true if all containers are healthy', async () => {
      const mockContainer1 = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true, Status: 'running' },
        }),
      };
      const mockContainer2 = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true, Status: 'running' },
        }),
      };

      const result = await healthChecker.areAllHealthy([
        mockContainer1 as any,
        mockContainer2 as any,
      ]);

      expect(result).toBe(true);
    });

    it('should return false if any container is unhealthy', async () => {
      const mockContainer1 = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: true, Status: 'running' },
        }),
      };
      const mockContainer2 = {
        inspect: vi.fn().mockResolvedValue({
          State: { Running: false, Status: 'exited' },
        }),
      };

      const result = await healthChecker.areAllHealthy([
        mockContainer1 as any,
        mockContainer2 as any,
      ]);

      expect(result).toBe(false);
    });

    it('should handle empty array', async () => {
      const result = await healthChecker.areAllHealthy([]);

      expect(result).toBe(true);
    });
  });

  describe('getHealthStatuses', () => {
    it('should return health status map for all containers', async () => {
      const mockContainer1 = {
        inspect: vi
          .fn()
          .mockResolvedValueOnce({
            Id: 'container1',
            State: { Running: true, Status: 'running' },
          })
          .mockResolvedValueOnce({
            Id: 'container1',
            State: { Running: true, Status: 'running' },
          }),
      };
      const mockContainer2 = {
        inspect: vi
          .fn()
          .mockResolvedValueOnce({
            Id: 'container2',
            State: { Running: false, Status: 'exited' },
          })
          .mockResolvedValueOnce({
            Id: 'container2',
            State: { Running: false, Status: 'exited' },
          }),
      };

      const result = await healthChecker.getHealthStatuses([
        mockContainer1 as any,
        mockContainer2 as any,
      ]);

      expect(result.size).toBe(2);
      expect(result.get('container1')).toEqual({
        healthy: true,
        status: 'running (no health check)',
      });
      expect(result.get('container2')).toEqual({
        healthy: false,
        status: 'exited',
      });
    });

    it('should handle empty array', async () => {
      const result = await healthChecker.getHealthStatuses([]);

      expect(result.size).toBe(0);
    });
  });
});
