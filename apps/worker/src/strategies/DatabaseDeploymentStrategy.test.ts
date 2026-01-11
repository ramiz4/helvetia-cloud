import Docker from 'dockerode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentContext } from '../interfaces';
import { DatabaseDeploymentStrategy } from './DatabaseDeploymentStrategy';

describe('DatabaseDeploymentStrategy', () => {
  let strategy: DatabaseDeploymentStrategy;
  let mockDocker: any;
  let mockJob: any;

  beforeEach(() => {
    strategy = new DatabaseDeploymentStrategy();

    mockDocker = {
      pull: vi.fn(),
      modem: {
        followProgress: vi.fn(),
      },
    };

    mockJob = {
      data: {},
    };

    // Reset console spies
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('canHandle', () => {
    it('should handle POSTGRES type', () => {
      expect(strategy.canHandle('POSTGRES')).toBe(true);
    });

    it('should handle REDIS type', () => {
      expect(strategy.canHandle('REDIS')).toBe(true);
    });

    it('should handle MYSQL type', () => {
      expect(strategy.canHandle('MYSQL')).toBe(true);
    });

    it('should not handle DOCKER type', () => {
      expect(strategy.canHandle('DOCKER')).toBe(false);
    });

    it('should not handle STATIC type', () => {
      expect(strategy.canHandle('STATIC')).toBe(false);
    });

    it('should not handle COMPOSE type', () => {
      expect(strategy.canHandle('COMPOSE')).toBe(false);
    });

    it('should not handle unknown types', () => {
      expect(strategy.canHandle('UNKNOWN')).toBe(false);
    });
  });

  describe('deploy', () => {
    it('should deploy POSTGRES with correct image', async () => {
      const mockStream = {};
      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation(
        (_stream: unknown, callback: (err: unknown, result?: unknown[]) => void) => {
          callback(null, []);
        },
      );

      const context: DeploymentContext = {
        job: mockJob,
        docker: mockDocker as Docker,
        deploymentId: 'deploy-123',
        serviceId: 'service-123',
        serviceName: 'my-postgres',
        repoUrl: 'https://github.com/example/repo',
        branch: 'main',
        type: 'POSTGRES',
      };

      const result = await strategy.deploy(context);

      expect(mockDocker.pull).toHaveBeenCalledWith('postgres:15-alpine');
      expect(result.imageTag).toBe('postgres:15-alpine');
      expect(result.success).toBe(true);
      expect(result.buildLogs).toContain('Managed service deployment');
    });

    it('should deploy REDIS with correct image', async () => {
      const mockStream = {};
      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation(
        (_stream: unknown, callback: (err: unknown, result?: unknown[]) => void) => {
          callback(null, []);
        },
      );

      const context: DeploymentContext = {
        job: mockJob,
        docker: mockDocker as Docker,
        deploymentId: 'deploy-123',
        serviceId: 'service-123',
        serviceName: 'my-redis',
        repoUrl: 'https://github.com/example/repo',
        branch: 'main',
        type: 'REDIS',
      };

      const result = await strategy.deploy(context);

      expect(mockDocker.pull).toHaveBeenCalledWith('redis:7-alpine');
      expect(result.imageTag).toBe('redis:7-alpine');
      expect(result.success).toBe(true);
    });

    it('should deploy MYSQL with correct image', async () => {
      const mockStream = {};
      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation(
        (_stream: unknown, callback: (err: unknown, result?: unknown[]) => void) => {
          callback(null, []);
        },
      );

      const context: DeploymentContext = {
        job: mockJob,
        docker: mockDocker as Docker,
        deploymentId: 'deploy-123',
        serviceId: 'service-123',
        serviceName: 'my-mysql',
        repoUrl: 'https://github.com/example/repo',
        branch: 'main',
        type: 'MYSQL',
      };

      const result = await strategy.deploy(context);

      expect(mockDocker.pull).toHaveBeenCalledWith('mysql:8');
      expect(result.imageTag).toBe('mysql:8');
      expect(result.success).toBe(true);
    });

    it('should throw error for unknown database type', async () => {
      const context: DeploymentContext = {
        job: mockJob,
        docker: mockDocker as Docker,
        deploymentId: 'deploy-123',
        serviceId: 'service-123',
        serviceName: 'my-db',
        repoUrl: 'https://github.com/example/repo',
        branch: 'main',
        type: 'UNKNOWN_DB',
      };

      await expect(strategy.deploy(context)).rejects.toThrow('Unknown database type: UNKNOWN_DB');
    });

    it('should handle pull errors gracefully', async () => {
      mockDocker.pull.mockRejectedValue(new Error('Network error'));

      const context: DeploymentContext = {
        job: mockJob,
        docker: mockDocker as Docker,
        deploymentId: 'deploy-123',
        serviceId: 'service-123',
        serviceName: 'my-postgres',
        repoUrl: 'https://github.com/example/repo',
        branch: 'main',
        type: 'POSTGRES',
      };

      await expect(strategy.deploy(context)).rejects.toThrow(
        'Failed to pull database image: Error: Network error',
      );
    });

    it('should handle followProgress errors', async () => {
      const mockStream = {};
      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation(
        (_stream: unknown, callback: (err: unknown, result?: unknown[]) => void) => {
          callback(new Error('Stream error'));
        },
      );

      const context: DeploymentContext = {
        job: mockJob,
        docker: mockDocker as Docker,
        deploymentId: 'deploy-123',
        serviceId: 'service-123',
        serviceName: 'my-postgres',
        repoUrl: 'https://github.com/example/repo',
        branch: 'main',
        type: 'POSTGRES',
      };

      await expect(strategy.deploy(context)).rejects.toThrow(
        'Failed to pull database image: Error: Stream error',
      );
    });
  });
});
