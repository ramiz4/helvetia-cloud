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

import { worker } from './worker';

describe('Worker', () => {
  it('should be defined', () => {
    expect(worker).toBeDefined();
  });
});
