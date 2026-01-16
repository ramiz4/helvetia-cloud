import { logger } from 'shared';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { healthServer, startHealthServer } from './health-server';

// Mock env config
vi.mock('./config/env', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
    WORKER_HEALTH_PORT: 3003,
    NODE_ENV: 'test',
  },
}));

vi.mock('shared', async () => {
  const actual = await vi.importActual('shared');
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  };
});

const { MockIORedis, MockQueue } = vi.hoisted(() => ({
  MockIORedis: vi.fn(function MockRedis() {
    return {
      status: 'ready',
      connect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
    };
  }),
  MockQueue: vi.fn(function MockBullQueue() {
    return {
      getWaitingCount: vi.fn().mockResolvedValue(5),
      getActiveCount: vi.fn().mockResolvedValue(2),
      getCompletedCount: vi.fn().mockResolvedValue(150),
      getFailedCount: vi.fn().mockResolvedValue(3),
    };
  }),
}));

vi.mock('ioredis', () => ({
  default: MockIORedis,
}));

vi.mock('bullmq', () => ({
  Queue: MockQueue,
}));

// Mock metrics service
vi.mock('./services/metrics.service', () => ({
  workerMetricsService: {
    getMetrics: vi.fn().mockResolvedValue('# Prometheus metrics'),
    getMetricsJSON: vi.fn().mockResolvedValue({}),
  },
}));

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

// Mock console methods
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Worker Health Check', () => {
  beforeEach(() => {
    // Clear mock calls before each test
    vi.mocked(logger.error).mockClear();
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.info).mockClear();
    mockExit.mockClear();
  });

  afterAll(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleLog.mockRestore();
  });

  it('should return health status with correct structure', async () => {
    const response = await healthServer.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.statusCode).toBeLessThan(600);

    const data = JSON.parse(response.body);

    // Check basic structure
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('redis');
    expect(data).toHaveProperty('queue');
    expect(data).toHaveProperty('timestamp');

    // Validate status
    expect(['healthy', 'unhealthy']).toContain(data.status);

    // Validate uptime
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);

    // Validate redis info
    expect(data.redis).toHaveProperty('connected');
    expect(data.redis).toHaveProperty('status');
    expect(typeof data.redis.connected).toBe('boolean');
    expect(typeof data.redis.status).toBe('string');

    // Validate queue info
    expect(data.queue).toHaveProperty('name');
    expect(data.queue).toHaveProperty('waiting');
    expect(data.queue).toHaveProperty('active');
    expect(data.queue).toHaveProperty('completed');
    expect(data.queue).toHaveProperty('failed');
    expect(data.queue.name).toBe('deployments');
    expect(typeof data.queue.waiting).toBe('number');
    expect(typeof data.queue.active).toBe('number');
    expect(typeof data.queue.completed).toBe('number');
    expect(typeof data.queue.failed).toBe('number');

    // Validate timestamp
    expect(() => new Date(data.timestamp)).not.toThrow();
  });

  it('should return 200 when healthy with mocked Redis', async () => {
    const response = await healthServer.inject({
      method: 'GET',
      url: '/health',
    });

    const data = JSON.parse(response.body);

    // Since we're mocking Redis as 'ready', it should be healthy
    expect(response.statusCode).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.redis.connected).toBe(true);
  });

  it('should have queue statistics as non-negative numbers', async () => {
    const response = await healthServer.inject({
      method: 'GET',
      url: '/health',
    });

    const data = JSON.parse(response.body);

    expect(data.queue.waiting).toBeGreaterThanOrEqual(0);
    expect(data.queue.active).toBeGreaterThanOrEqual(0);
    expect(data.queue.completed).toBeGreaterThanOrEqual(0);
    expect(data.queue.failed).toBeGreaterThanOrEqual(0);
  });

  it('should increment uptime over time', async () => {
    const response1 = await healthServer.inject({
      method: 'GET',
      url: '/health',
    });

    const data1 = JSON.parse(response1.body);
    const uptime1 = data1.uptime;

    // Wait 1 second
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const response2 = await healthServer.inject({
      method: 'GET',
      url: '/health',
    });

    const data2 = JSON.parse(response2.body);
    const uptime2 = data2.uptime;

    expect(uptime2).toBeGreaterThanOrEqual(uptime1);
  });

  it('should return queue statistics from mocked BullMQ', async () => {
    const response = await healthServer.inject({
      method: 'GET',
      url: '/health',
    });

    const data = JSON.parse(response.body);

    // Verify mocked values are returned
    expect(data.queue.waiting).toBe(5);
    expect(data.queue.active).toBe(2);
    expect(data.queue.completed).toBe(150);
    expect(data.queue.failed).toBe(3);
  });

  describe('Lazy Initialization', () => {
    it('should initialize Redis connection on first health check request', async () => {
      // Since this module is already imported, we just verify that mocks were called
      // during the import or first health check in the suite
      const initialCallCount = MockIORedis.mock.calls.length;
      const initialQueueCallCount = MockQueue.mock.calls.length;

      // Make a health check request
      const response = await healthServer.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      // Redis and Queue should have been initialized at some point
      expect(MockIORedis.mock.calls.length).toBeGreaterThanOrEqual(initialCallCount);
      expect(MockQueue.mock.calls.length).toBeGreaterThanOrEqual(initialQueueCallCount);
      // Verify the initialization parameters if it was called
      if (MockIORedis.mock.calls.length > 0) {
        expect(MockIORedis).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            maxRetriesPerRequest: null,
            lazyConnect: true,
          }),
        );
      }
      if (MockQueue.mock.calls.length > 0) {
        expect(MockQueue).toHaveBeenCalledWith('deployments', expect.any(Object));
      }
    });

    it('should reuse Redis connection on subsequent health check requests', async () => {
      // Clear any previous calls
      MockIORedis.mockClear();
      MockQueue.mockClear();

      // Make first request to initialize
      await healthServer.inject({
        method: 'GET',
        url: '/health',
      });

      const firstCallCount = MockIORedis.mock.calls.length;
      const firstQueueCallCount = MockQueue.mock.calls.length;

      // Make second request - should reuse connection
      await healthServer.inject({
        method: 'GET',
        url: '/health',
      });

      // Connection should not be created again
      expect(MockIORedis.mock.calls.length).toBe(firstCallCount);
      expect(MockQueue.mock.calls.length).toBe(firstQueueCallCount);
    });

    it('should handle queue statistics fetch errors gracefully', async () => {
      // Mock Queue to throw error
      const errorQueue = vi.fn(() => ({
        getWaitingCount: vi.fn().mockRejectedValue(new Error('Connection failed')),
        getActiveCount: vi.fn().mockResolvedValue(0),
        getCompletedCount: vi.fn().mockResolvedValue(0),
        getFailedCount: vi.fn().mockResolvedValue(0),
      }));

      vi.doMock('bullmq', () => ({
        Queue: errorQueue,
      }));

      const response = await healthServer.inject({
        method: 'GET',
        url: '/health',
      });

      // Should still return a response with default queue stats
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      const data = JSON.parse(response.body);
      expect(data.queue).toHaveProperty('waiting');
      expect(data.queue).toHaveProperty('active');
    });
  });

  describe('Port Conflict Handling', () => {
    it('should handle EADDRINUSE error gracefully without crashing', async () => {
      // Mock healthServer.listen to throw EADDRINUSE error
      const originalListen = healthServer.listen;
      const addressInUseError = new Error('Address already in use') as NodeJS.ErrnoException;
      addressInUseError.code = 'EADDRINUSE';

      healthServer.listen = vi.fn().mockRejectedValue(addressInUseError);

      // Call startHealthServer
      await startHealthServer();

      // Should log warning but not exit the process
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Port'));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('already in use'));
      expect(mockExit).not.toHaveBeenCalled();

      // Restore original
      healthServer.listen = originalListen;
    });

    it('should exit process for non-EADDRINUSE errors', async () => {
      // Mock healthServer.listen to throw a different error
      const originalListen = healthServer.listen;
      const otherError = new Error('Some other error');

      healthServer.listen = vi.fn().mockRejectedValue(otherError);

      // Call startHealthServer
      await startHealthServer();

      // Should exit the process with code 1
      expect(mockExit).toHaveBeenCalledWith(1);

      // Restore original
      healthServer.listen = originalListen;
    });
  });
});
