import { describe, expect, it, vi } from 'vitest';

// Mocks
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    subscribe: vi.fn(),
    removeListener: vi.fn(),
    quit: vi.fn(),
    publish: vi.fn(),
  };
  return {
    default: vi.fn(function () {
      return mockRedis;
    }),
  };
});

vi.mock('bullmq', () => {
  return {
    Worker: vi.fn(function () {
      return {
        close: vi.fn(),
      };
    }),
  };
});

vi.mock('database', () => {
  return {
    prisma: {
      deployment: {
        update: vi.fn(),
      },
      service: {
        update: vi.fn(),
      },
    },
  };
});

vi.mock('dockerode', () => {
  return {
    default: vi.fn(function () {
      return {
        createContainer: vi.fn(),
        listContainers: vi.fn().mockResolvedValue([]),
        getContainer: vi.fn(),
      };
    }),
  };
});

import { getSecureBindMounts } from './utils/workspace';
import { worker } from './worker';

describe('Worker', () => {
  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('Security - Mount Configuration', () => {
    it('should not expose host filesystem via bind mounts', () => {
      const mounts = getSecureBindMounts();

      // Check that dangerous mounts are not present
      const dangerousPaths = ['/Users', '/home', '/root', '/etc'];
      const hasDangerousMount = mounts.some((mount) => {
        const hostPath = mount.split(':')[0];
        return dangerousPaths.some(
          (dangerous) => hostPath === dangerous || hostPath.startsWith(dangerous + '/'),
        );
      });

      expect(hasDangerousMount).toBe(false);
    });

    it('should only mount Docker socket', () => {
      const mounts = getSecureBindMounts();

      expect(mounts).toHaveLength(1);
      expect(mounts[0]).toBe('/var/run/docker.sock:/var/run/docker.sock');
    });

    it('should not mount any host directories', () => {
      const mounts = getSecureBindMounts();

      // Filter out the Docker socket mount
      const hostDirMounts = mounts.filter((mount) => {
        const hostPath = mount.split(':')[0];
        return hostPath !== '/var/run/docker.sock';
      });

      // Should not mount any host directories
      expect(hostDirMounts).toHaveLength(0);
    });
  });
});
