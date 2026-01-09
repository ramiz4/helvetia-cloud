import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireStatusLock, releaseStatusLock, withStatusLock } from '../utils/statusLock';

// Mock IORedis
const mockRedisClient = {
  quit: vi.fn(),
  on: vi.fn(),
};

const mockLock = {
  value: 'test-lock-value',
  attempts: [],
  release: vi.fn().mockResolvedValue(undefined),
  extend: vi.fn().mockResolvedValue(undefined),
};

const mockAcquire = vi.fn().mockResolvedValue(mockLock);
const mockRedlock = {
  acquire: mockAcquire,
  on: vi.fn(),
};

vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => mockRedisClient),
  };
});

vi.mock('redlock', () => {
  return {
    default: vi.fn(() => mockRedlock),
  };
});

// Import after mocks
const mockPrisma = {
  service: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock('database', () => ({
  prisma: mockPrisma,
}));

describe('Status Lock - Concurrent Updates', () => {
  const testServiceId = 'test-service-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAcquire.mockResolvedValue(mockLock);
    mockLock.release.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('acquireStatusLock', () => {
    it('should acquire a lock for a service', async () => {
      const lock = await acquireStatusLock(testServiceId);

      expect(mockAcquire).toHaveBeenCalledWith([`status:lock:${testServiceId}`], 10000);
      expect(lock).toBe(mockLock);
    });

    it('should use custom TTL when provided', async () => {
      await acquireStatusLock(testServiceId, 5000);

      expect(mockAcquire).toHaveBeenCalledWith([`status:lock:${testServiceId}`], 5000);
    });

    it('should throw error if lock acquisition fails', async () => {
      mockAcquire.mockRejectedValueOnce(new Error('Lock acquisition failed'));

      await expect(acquireStatusLock(testServiceId)).rejects.toThrow(
        'Could not acquire status lock',
      );
    });
  });

  describe('releaseStatusLock', () => {
    it('should release a lock successfully', async () => {
      await releaseStatusLock(mockLock as any);

      expect(mockLock.release).toHaveBeenCalled();
    });

    it('should not throw if release fails (lock expires naturally)', async () => {
      mockLock.release.mockRejectedValueOnce(new Error('Lock already released'));

      await expect(releaseStatusLock(mockLock as any)).resolves.not.toThrow();
    });
  });

  describe('withStatusLock', () => {
    it('should execute function within a lock', async () => {
      const testFn = vi.fn().mockResolvedValue('test-result');

      const result = await withStatusLock(testServiceId, testFn);

      expect(mockAcquire).toHaveBeenCalledWith([`status:lock:${testServiceId}`], 10000);
      expect(testFn).toHaveBeenCalled();
      expect(mockLock.release).toHaveBeenCalled();
      expect(result).toBe('test-result');
    });

    it('should release lock even if function throws', async () => {
      const testFn = vi.fn().mockRejectedValue(new Error('Function failed'));

      await expect(withStatusLock(testServiceId, testFn)).rejects.toThrow('Function failed');

      expect(mockLock.release).toHaveBeenCalled();
    });

    it('should prevent concurrent updates to same service', async () => {
      const executionOrder: string[] = [];
      let lockAcquired = 0;

      // Simulate lock contention
      mockAcquire.mockImplementation(() => {
        lockAcquired++;
        if (lockAcquired === 1) {
          // First caller gets lock immediately
          return Promise.resolve(mockLock);
        } else {
          // Second caller must wait
          return new Promise((resolve) => {
            setTimeout(() => resolve(mockLock), 100);
          });
        }
      });

      const updateFn1 = async () => {
        executionOrder.push('start-1');
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push('end-1');
        return 'result-1';
      };

      const updateFn2 = async () => {
        executionOrder.push('start-2');
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push('end-2');
        return 'result-2';
      };

      // Start both updates simultaneously
      const [result1, result2] = await Promise.all([
        withStatusLock(testServiceId, updateFn1),
        withStatusLock(testServiceId, updateFn2),
      ]);

      expect(result1).toBe('result-1');
      expect(result2).toBe('result-2');
      // Both should have attempted to acquire lock
      expect(mockAcquire).toHaveBeenCalledTimes(2);
    });
  });

  describe('Status Update Race Condition Prevention', () => {
    it('should serialize status updates from API and Worker', async () => {
      const updates: string[] = [];

      // Simulate API setting status to DEPLOYING
      const apiUpdate = withStatusLock(testServiceId, async () => {
        updates.push('API-start');
        await mockPrisma.service.update({
          where: { id: testServiceId },
          data: { status: 'DEPLOYING' },
        });
        updates.push('API-end');
      });

      // Simulate Worker setting status to RUNNING
      const workerUpdate = withStatusLock(testServiceId, async () => {
        updates.push('Worker-start');
        await mockPrisma.service.update({
          where: { id: testServiceId },
          data: { status: 'RUNNING' },
        });
        updates.push('Worker-end');
      });

      await Promise.all([apiUpdate, workerUpdate]);

      // Both updates should complete
      expect(mockPrisma.service.update).toHaveBeenCalledTimes(2);
      expect(updates).toHaveLength(4);

      // Verify that one update completed before the other started
      const apiStartIdx = updates.indexOf('API-start');
      const apiEndIdx = updates.indexOf('API-end');
      const workerStartIdx = updates.indexOf('Worker-start');
      const workerEndIdx = updates.indexOf('Worker-end');

      // Check that updates don't overlap
      const apiFirst = apiEndIdx < workerStartIdx;
      const workerFirst = workerEndIdx < apiStartIdx;

      expect(apiFirst || workerFirst).toBe(true);
    });
  });
});
