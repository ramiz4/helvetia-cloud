import Docker from 'dockerode';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DockerContainerOrchestrator } from './DockerContainerOrchestrator';

describe('DockerContainerOrchestrator', () => {
  let orchestrator: DockerContainerOrchestrator;
  let mockDocker: any;

  beforeEach(() => {
    // Create mock Docker instance
    mockDocker = {
      listContainers: vi.fn(),
      getContainer: vi.fn(),
      createContainer: vi.fn(),
      buildImage: vi.fn(),
      pull: vi.fn(),
    };

    // Pass mock Docker instance to orchestrator
    orchestrator = new DockerContainerOrchestrator(mockDocker as Docker);
  });

  describe('listContainers', () => {
    it('should list containers and transform to ContainerStatus', async () => {
      const mockContainers = [
        {
          Id: 'abc123',
          Names: ['/test-container'],
          State: 'running',
          Status: 'Up 5 minutes',
          Image: 'nginx:latest',
          Labels: { 'helvetia.serviceId': 'service-1' },
        },
      ];

      mockDocker.listContainers.mockResolvedValue(mockContainers);

      const result = await orchestrator.listContainers({ all: true });

      expect(result).toEqual([
        {
          id: 'abc123',
          name: 'test-container',
          state: 'running',
          status: 'Up 5 minutes',
          image: 'nginx:latest',
          labels: { 'helvetia.serviceId': 'service-1' },
        },
      ]);
      expect(mockDocker.listContainers).toHaveBeenCalledWith({ all: true });
    });

    it('should handle containers with no labels', async () => {
      const mockContainers = [
        {
          Id: 'def456',
          Names: ['/plain-container'],
          State: 'running',
          Status: 'Up 1 hour',
          Image: 'alpine:latest',
          Labels: undefined,
        },
      ];

      mockDocker.listContainers.mockResolvedValue(mockContainers);

      const result = await orchestrator.listContainers();

      expect(result[0].labels).toEqual({});
    });
  });

  describe('getContainer', () => {
    it('should get a container by ID', async () => {
      const mockContainer = { id: 'abc123' };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await orchestrator.getContainer('abc123');

      expect(result).toBe(mockContainer);
      expect(mockDocker.getContainer).toHaveBeenCalledWith('abc123');
    });
  });

  describe('createContainer', () => {
    it('should create a container with proper options', async () => {
      const mockContainer = { id: 'new-container' };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      const options = {
        name: 'test-container',
        image: 'nginx:latest',
        env: { NODE_ENV: 'production', PORT: '3000' },
        labels: { app: 'test' },
      };

      const result = await orchestrator.createContainer(options);

      expect(result).toBe(mockContainer);
      expect(mockDocker.createContainer).toHaveBeenCalledWith({
        name: 'test-container',
        Image: 'nginx:latest',
        Env: ['NODE_ENV=production', 'PORT=3000'],
        Labels: { app: 'test' },
        ExposedPorts: undefined,
        HostConfig: undefined,
      });
    });

    it('should handle empty env object', async () => {
      const mockContainer = { id: 'new-container' };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await orchestrator.createContainer({
        name: 'test',
        image: 'nginx',
      });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Env: undefined,
        }),
      );
    });
  });

  describe('startContainer', () => {
    it('should start a container', async () => {
      const mockContainer = {
        start: vi.fn().mockResolvedValue(undefined),
      };

      await orchestrator.startContainer(mockContainer as any);

      expect(mockContainer.start).toHaveBeenCalled();
    });
  });

  describe('stopContainer', () => {
    it('should stop a container with default timeout', async () => {
      const mockContainer = {
        stop: vi.fn().mockResolvedValue(undefined),
      };

      await orchestrator.stopContainer(mockContainer as any);

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: undefined });
    });

    it('should stop a container with custom timeout', async () => {
      const mockContainer = {
        stop: vi.fn().mockResolvedValue(undefined),
      };

      await orchestrator.stopContainer(mockContainer as any, 30);

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 30 });
    });
  });

  describe('removeContainer', () => {
    it('should remove a container', async () => {
      const mockContainer = {
        remove: vi.fn().mockResolvedValue(undefined),
      };

      await orchestrator.removeContainer(mockContainer as any);

      expect(mockContainer.remove).toHaveBeenCalledWith(undefined);
    });

    it('should remove a container with force option', async () => {
      const mockContainer = {
        remove: vi.fn().mockResolvedValue(undefined),
      };

      await orchestrator.removeContainer(mockContainer as any, { force: true });

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });
  });

  describe('buildImage', () => {
    it('should build an image', async () => {
      const mockStream = { pipe: vi.fn() };
      mockDocker.buildImage.mockResolvedValue(mockStream);

      const options = {
        context: '/path/to/context',
        src: ['Dockerfile', 'package.json'],
        tags: ['myapp:latest', 'myapp:v1.0.0'],
        buildargs: { NODE_ENV: 'production' },
      };

      const result = await orchestrator.buildImage(options);

      expect(result).toBe(mockStream);
      expect(mockDocker.buildImage).toHaveBeenCalledWith(
        {
          context: '/path/to/context',
          src: ['Dockerfile', 'package.json'],
        },
        {
          t: ['myapp:latest', 'myapp:v1.0.0'],
          buildargs: { NODE_ENV: 'production' },
        },
      );
    });
  });

  describe('pullImage', () => {
    it('should pull an image', async () => {
      const mockStream = { pipe: vi.fn() };
      mockDocker.pull.mockResolvedValue(mockStream);

      const result = await orchestrator.pullImage('nginx:latest');

      expect(result).toBe(mockStream);
      expect(mockDocker.pull).toHaveBeenCalledWith('nginx:latest');
    });
  });

  describe('inspectContainer', () => {
    it('should inspect a container', async () => {
      const mockInspectInfo = {
        Id: 'abc123',
        State: { Running: true },
        Config: { Image: 'nginx:latest' },
      };
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue(mockInspectInfo),
      };

      const result = await orchestrator.inspectContainer(mockContainer as any);

      expect(result).toBe(mockInspectInfo);
      expect(mockContainer.inspect).toHaveBeenCalled();
    });
  });

  describe('getContainerLogs', () => {
    it('should get container logs with default options', async () => {
      const mockStream = { pipe: vi.fn() };
      const mockContainer = {
        logs: vi.fn().mockResolvedValue(mockStream),
      };

      const result = await orchestrator.getContainerLogs(mockContainer as any);

      expect(result).toBe(mockStream);
      expect(mockContainer.logs).toHaveBeenCalledWith({
        stdout: true,
        stderr: true,
        tail: undefined,
      });
    });

    it('should get container logs with custom options', async () => {
      const mockStream = { pipe: vi.fn() };
      const mockContainer = {
        logs: vi.fn().mockResolvedValue(mockStream),
      };

      await orchestrator.getContainerLogs(mockContainer as any, {
        stdout: false,
        stderr: true,
        tail: 100,
      });

      expect(mockContainer.logs).toHaveBeenCalledWith({
        stdout: false,
        stderr: true,
        tail: 100,
      });
    });
  });

  describe('getContainerStats', () => {
    it('should get container stats', async () => {
      const mockStats = {
        cpu_stats: { cpu_usage: { total_usage: 1000 } },
        memory_stats: { usage: 2000 },
      };
      const mockContainer = {
        stats: vi.fn().mockResolvedValue(mockStats),
      };

      const result = await orchestrator.getContainerStats(mockContainer as any);

      expect(result).toBe(mockStats);
      expect(mockContainer.stats).toHaveBeenCalledWith({ stream: false });
    });
  });

  describe('getDockerInstance', () => {
    it('should return the underlying Docker instance', () => {
      const dockerInstance = orchestrator.getDockerInstance();

      expect(dockerInstance).toBe(mockDocker);
    });
  });
});
