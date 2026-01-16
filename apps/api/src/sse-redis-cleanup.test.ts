import { prisma } from 'database';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from './server';

// Skip these integration tests if DATABASE_URL is not set
// These tests require a real database to run
const shouldSkip = !process.env.DATABASE_URL;
const describeIf = shouldSkip ? describe.skip : describe;

describeIf('SSE Redis Subscription Cleanup Tests', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Ensure clean state for test user
    await prisma.deployment.deleteMany({
      where: { service: { user: { githubId: 'test-gh-redis-cleanup' } } },
    });
    await prisma.service.deleteMany({ where: { user: { githubId: 'test-gh-redis-cleanup' } } });
    await prisma.user.deleteMany({ where: { githubId: 'test-gh-redis-cleanup' } });

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        username: 'redis-cleanup-test-user',
        githubId: 'test-gh-redis-cleanup',
      },
    });
    testUserId = testUser.id;

    // Generate JWT token for auth
    authToken = app.jwt.sign({ id: testUserId, username: testUser.username });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await prisma.deployment
        .deleteMany({ where: { service: { userId: testUserId } } })
        .catch(() => {});
      await prisma.service.deleteMany({ where: { userId: testUserId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.deployment.deleteMany({ where: { service: { userId: testUserId } } });
    await prisma.service.deleteMany({ where: { userId: testUserId } });
  });

  describe('GET /deployments/:id/logs/stream', () => {
    it('should use dedicated Redis connection for pub/sub', async () => {
      // Create a test service and deployment
      const service = await prisma.service.create({
        data: {
          name: 'test-redis-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'DEPLOYING',
        },
      });

      const deployment = await prisma.deployment.create({
        data: {
          serviceId: service.id,
          status: 'BUILDING',
          commitHash: 'abc123',
        },
      });

      // Spy on Redis duplicate method
      const duplicateSpy = vi.spyOn(app.redis, 'duplicate');

      // Make the request (don't await, as SSE keeps connection open)
      const responsePromise = app.inject({
        method: 'GET',
        url: `/api/v1/deployments/${deployment.id}/logs/stream`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Wait a bit for the connection to be established
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify that duplicate was called to create a dedicated connection
      expect(duplicateSpy).toHaveBeenCalled();

      duplicateSpy.mockRestore();

      // Wait for response to complete (it will timeout quickly in test mode)
      await responsePromise;
    });

    it('should properly close dedicated Redis connection on cleanup', async () => {
      // Create a test service and deployment
      const service = await prisma.service.create({
        data: {
          name: 'test-redis-cleanup-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'DEPLOYING',
        },
      });

      const deployment = await prisma.deployment.create({
        data: {
          serviceId: service.id,
          status: 'BUILDING',
          commitHash: 'abc123',
        },
      });

      // Track the duplicated connection
      let duplicatedConnection: any = null;
      const originalDuplicate = app.redis.duplicate.bind(app.redis);

      vi.spyOn(app.redis, 'duplicate').mockImplementation(() => {
        duplicatedConnection = originalDuplicate();
        return duplicatedConnection;
      });

      // Spy on quit method of the duplicated connection
      let quitSpy: ReturnType<typeof vi.spyOn> | null = null;
      const quitPromise = new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (duplicatedConnection && !quitSpy) {
            quitSpy = vi.spyOn(duplicatedConnection, 'quit');
            quitSpy.mockImplementation(async () => {
              resolve();
              return 'OK';
            });
            clearInterval(checkInterval);
          }
        }, 10);

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });

      // Make the request
      const responsePromise = app.inject({
        method: 'GET',
        url: `/api/v1/deployments/${deployment.id}/logs/stream`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Wait for quit to be called (connection cleanup happens on timeout in test mode)
      await quitPromise;

      // Wait for response to complete
      await responsePromise;

      // Verify that quit was called to close the dedicated connection
      expect(quitSpy).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('should handle Redis connection errors gracefully', async () => {
      // Create a test service and deployment
      const service = await prisma.service.create({
        data: {
          name: 'test-redis-error-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'DEPLOYING',
        },
      });

      const deployment = await prisma.deployment.create({
        data: {
          serviceId: service.id,
          status: 'BUILDING',
          commitHash: 'abc123',
        },
      });

      // Mock duplicate to return a mock connection that will emit an error
      const mockConnection = {
        subscribe: vi.fn().mockResolvedValue(1),
        unsubscribe: vi.fn().mockResolvedValue(1),
        on: vi.fn(),
        removeListener: vi.fn(),
        quit: vi.fn().mockResolvedValue('OK'),
        emit: vi.fn(),
      };
      vi.spyOn(app.redis, 'duplicate').mockReturnValue(mockConnection as any);

      // Make the request
      const responsePromise = app.inject({
        method: 'GET',
        url: `/api/v1/deployments/${deployment.id}/logs/stream`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Wait a bit for the connection to be established
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate calling the error handler that was registered
      const errorHandler = mockConnection.on.mock.calls.find((call) => call[0] === 'error')?.[1];
      if (errorHandler) {
        errorHandler(new Error('Test Redis error'));
      }

      // Wait for response to complete
      const response = await responsePromise;

      // Connection should still be established despite the error
      expect(response.statusCode).toBe(200);

      vi.restoreAllMocks();
    });

    it('should cleanup subscription on client disconnect', async () => {
      // Create a test service and deployment
      const service = await prisma.service.create({
        data: {
          name: 'test-disconnect-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'DEPLOYING',
        },
      });

      const deployment = await prisma.deployment.create({
        data: {
          serviceId: service.id,
          status: 'BUILDING',
          commitHash: 'abc123',
        },
      });

      // Track the duplicated connection
      let duplicatedConnection: any = null;
      const originalDuplicate = app.redis.duplicate.bind(app.redis);

      vi.spyOn(app.redis, 'duplicate').mockImplementation(() => {
        duplicatedConnection = originalDuplicate();
        return duplicatedConnection;
      });

      // Spy on unsubscribe
      let unsubscribeSpy: ReturnType<typeof vi.spyOn> | null = null;
      const unsubscribePromise = new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (duplicatedConnection && !unsubscribeSpy) {
            const original = duplicatedConnection.unsubscribe.bind(duplicatedConnection);
            unsubscribeSpy = vi.spyOn(duplicatedConnection, 'unsubscribe');
            unsubscribeSpy.mockImplementation(async (...args: any[]) => {
              resolve();
              return original(...args);
            });
            clearInterval(checkInterval);
          }
        }, 10);

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });

      // Make the request
      const responsePromise = app.inject({
        method: 'GET',
        url: `/api/v1/deployments/${deployment.id}/logs/stream`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Wait for unsubscribe to be called
      await unsubscribePromise;

      // Wait for response to complete
      await responsePromise;

      // Verify that unsubscribe was called
      expect(unsubscribeSpy).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });
});
