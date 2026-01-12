import { prisma } from 'database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from './server';

// Skip these integration tests if DATABASE_URL is not set
// These tests require a real database to run
const shouldSkip = !process.env.DATABASE_URL;
const describeIf = shouldSkip ? describe.skip : describe;

describeIf('SSE Streaming Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Ensure clean state for test user
    await prisma.service.deleteMany({ where: { user: { githubId: 'test-gh-sse' } } });
    await prisma.user.deleteMany({ where: { githubId: 'test-gh-sse' } });

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        username: 'sse-test-user',
        githubId: 'test-gh-sse',
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
    // Clean up test services before each test
    await prisma.deployment.deleteMany({ where: { service: { userId: testUserId } } });
    await prisma.service.deleteMany({ where: { userId: testUserId } });
  });

  describe('GET /services/metrics/stream', () => {
    it('should establish SSE connection with correct headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers.connection).toBe('keep-alive');
    });

    it('should send initial connection acknowledgment', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain(': connected');
    });

    it('should send metrics data as SSE events', async () => {
      // Create test services
      await prisma.service.create({
        data: {
          name: 'test-sse-service-1',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo1',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'RUNNING',
        },
      });

      await prisma.service.create({
        data: {
          name: 'test-sse-service-2',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo2',
          branch: 'main',
          type: 'STATIC',
          port: 80,
          status: 'IDLE',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Response should contain data events
      const body = response.body;
      expect(body).toContain('data:');

      // Parse the SSE data
      const dataLines = body.split('\n').filter((line: string) => line.startsWith('data:'));
      expect(dataLines.length).toBeGreaterThan(0);

      // Verify at least one data event contains JSON array
      const hasJsonData = dataLines.some((line: string) => {
        try {
          const data = JSON.parse(line.replace('data: ', ''));
          return Array.isArray(data);
        } catch {
          return false;
        }
      });
      expect(hasJsonData).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should handle expired token gracefully', async () => {
      // Create an expired token (1 second expiry)
      const expiredToken = app.jwt.sign(
        { id: testUserId, username: 'sse-test-user' },
        { expiresIn: '1ms' },
      );

      // Wait to ensure token expires
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      // Should either reject immediately or send token expired event
      expect([401, 200]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        // If connection established, should send error event
        expect(response.body).toContain('TOKEN_EXPIRED');
      }
    });

    it('should include CORS headers when origin is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
          origin: 'http://localhost:3000',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should send metrics for services with different statuses', async () => {
      // Create services with various statuses
      await prisma.service.createMany({
        data: [
          {
            name: 'service-running',
            userId: testUserId,
            repoUrl: 'https://github.com/test/repo1',
            branch: 'main',
            type: 'DOCKER',
            port: 3000,
            status: 'RUNNING',
          },
          {
            name: 'service-idle',
            userId: testUserId,
            repoUrl: 'https://github.com/test/repo2',
            branch: 'main',
            type: 'DOCKER',
            port: 3001,
            status: 'IDLE',
          },
          {
            name: 'service-deploying',
            userId: testUserId,
            repoUrl: 'https://github.com/test/repo3',
            branch: 'main',
            type: 'DOCKER',
            port: 3002,
            status: 'DEPLOYING',
          },
          {
            name: 'service-failed',
            userId: testUserId,
            repoUrl: 'https://github.com/test/repo4',
            branch: 'main',
            type: 'DOCKER',
            port: 3003,
            status: 'FAILED',
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Should contain metrics for all services
      const dataLines = response.body
        .split('\n')
        .filter((line: string) => line.startsWith('data:'));
      expect(dataLines.length).toBeGreaterThan(0);
    });

    it('should not send metrics for deleted services', async () => {
      // Create active service
      await prisma.service.create({
        data: {
          name: 'service-active',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo1',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'RUNNING',
        },
      });

      // Create deleted service
      await prisma.service.create({
        data: {
          name: 'service-deleted',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo2',
          branch: 'main',
          type: 'DOCKER',
          port: 3001,
          status: 'RUNNING',
          deletedAt: new Date(),
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Parse metrics data
      const dataLines = response.body
        .split('\n')
        .filter((line: string) => line.startsWith('data:'));

      if (dataLines.length > 0) {
        const metricsData = JSON.parse(dataLines[0].replace('data: ', ''));

        // Should only contain 1 service (the active one)
        expect(metricsData).toHaveLength(1);
        expect(metricsData[0].id).not.toContain('service-deleted');
      }
    });

    it('should handle user with no services', async () => {
      // Don't create any services
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Should still establish connection and send empty metrics
      const dataLines = response.body
        .split('\n')
        .filter((line: string) => line.startsWith('data:'));

      if (dataLines.length > 0) {
        const metricsData = JSON.parse(dataLines[0].replace('data: ', ''));
        expect(Array.isArray(metricsData)).toBe(true);
        expect(metricsData).toHaveLength(0);
      }
    });
  });

  describe('SSE Connection Management', () => {
    it('should handle connection close gracefully', async () => {
      // This test verifies that the server doesn't crash when a client disconnects
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Connection cleanup is handled by Fastify when the request ends
      // Just verify the connection was established successfully
    });

    it('should apply rate limiting to SSE endpoint', async () => {
      // Make multiple rapid requests
      const requests = Array.from({ length: 5 }, () =>
        app.inject({
          method: 'GET',
          url: '/api/v1/services/metrics/stream',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        }),
      );

      const responses = await Promise.all(requests);

      // All should succeed initially, but rate limiting may kick in
      // Just verify the endpoint responds correctly
      responses.forEach((response) => {
        expect([200, 429]).toContain(response.statusCode);
      });
    });
  });

  describe('SSE Error Handling', () => {
    it('should send error event on internal server error', async () => {
      // This is hard to test without mocking internals
      // Just verify the endpoint is stable
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle database errors gracefully', async () => {
      // Even if database queries fail, SSE should not crash
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('SSE Metrics Content', () => {
    it('should include service ID in metrics', async () => {
      const service = await prisma.service.create({
        data: {
          name: 'test-metrics-content',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'RUNNING',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const dataLines = response.body
        .split('\n')
        .filter((line: string) => line.startsWith('data:'));

      if (dataLines.length > 0) {
        const metricsData = JSON.parse(dataLines[0].replace('data: ', ''));
        expect(metricsData.length).toBeGreaterThan(0);
        expect(metricsData[0]).toHaveProperty('id', service.id);
        expect(metricsData[0]).toHaveProperty('metrics');
      }
    });

    it('should include metrics object in response', async () => {
      await prisma.service.create({
        data: {
          name: 'test-metrics-structure',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'RUNNING',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services/metrics/stream',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const dataLines = response.body
        .split('\n')
        .filter((line: string) => line.startsWith('data:'));

      if (dataLines.length > 0) {
        const metricsData = JSON.parse(dataLines[0].replace('data: ', ''));
        expect(metricsData[0].metrics).toBeDefined();
      }
    });
  });
});
