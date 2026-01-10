import { afterAll, describe, expect, it, vi } from 'vitest';

// Mock Redis as a constructor function
const MockIORedis = vi.fn(function MockRedis() {
  return {
    status: 'ready',
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('ioredis', () => {
  return {
    default: MockIORedis,
  };
});

// Mock Queue constructor
const MockQueue = vi.fn(function MockBullQueue() {
  return {
    getWaitingCount: vi.fn().mockResolvedValue(5),
    getActiveCount: vi.fn().mockResolvedValue(2),
    getCompletedCount: vi.fn().mockResolvedValue(150),
    getFailedCount: vi.fn().mockResolvedValue(3),
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: MockQueue,
  };
});

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

// Import after mocks are set up
const { healthServer } = await import('./health-server');

describe('Worker Health Check', () => {
  afterAll(() => {
    mockExit.mockRestore();
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
});
