import { prisma, SubscriptionPlan, SubscriptionStatus } from 'database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from './server';

// Skip these integration tests unless RUN_INTEGRATION_TESTS is set
// These tests require a real database to run
// Set RUN_INTEGRATION_TESTS=1 to enable these tests
const shouldSkip = process.env.RUN_INTEGRATION_TESTS !== '1';

describe.skipIf(shouldSkip)('Resource Limit Enforcement Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let freeUserId: string;
  let starterUserId: string;
  let proUserId: string;
  let freeAuthToken: string;
  let starterAuthToken: string;
  let freeEnvId: string;
  let starterEnvId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Clean up any existing test data
    await prisma.subscription.deleteMany({
      where: {
        user: {
          githubId: {
            in: ['test-gh-free', 'test-gh-starter', 'test-gh-pro'],
          },
        },
      },
    });
    await prisma.service.deleteMany({
      where: {
        user: {
          githubId: {
            in: ['test-gh-free', 'test-gh-starter', 'test-gh-pro'],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        githubId: {
          in: ['test-gh-free', 'test-gh-starter', 'test-gh-pro'],
        },
      },
    });

    // Create test users with different subscription tiers
    const freeUser = await prisma.user.create({
      data: {
        username: 'free-user',
        githubId: 'test-gh-free',
      },
    });
    freeUserId = freeUser.id;

    const starterUser = await prisma.user.create({
      data: {
        username: 'starter-user',
        githubId: 'test-gh-starter',
      },
    });
    starterUserId = starterUser.id;

    const proUser = await prisma.user.create({
      data: {
        username: 'pro-user',
        githubId: 'test-gh-pro',
      },
    });
    proUserId = proUser.id;

    // Create subscriptions
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    await prisma.subscription.create({
      data: {
        userId: freeUserId,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_free_test',
        currentPeriodStart: now,
        currentPeriodEnd: futureDate,
      },
    });

    await prisma.subscription.create({
      data: {
        userId: starterUserId,
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_starter_test',
        stripeSubscriptionId: 'sub_starter_test',
        currentPeriodStart: now,
        currentPeriodEnd: futureDate,
      },
    });

    await prisma.subscription.create({
      data: {
        userId: proUserId,
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_pro_test',
        stripeSubscriptionId: 'sub_pro_test',
        currentPeriodStart: now,
        currentPeriodEnd: futureDate,
      },
    });

    // Generate JWT tokens
    freeAuthToken = app.jwt.sign({ id: freeUserId, username: freeUser.username });
    starterAuthToken = app.jwt.sign({ id: starterUserId, username: starterUser.username });

    // Create default projects and environments
    const freeProject = await prisma.project.create({
      data: {
        name: 'default-project',
        userId: freeUserId,
      },
    });
    const freeEnv = await prisma.environment.create({
      data: {
        name: 'Production',
        projectId: freeProject.id,
      },
    });
    freeEnvId = freeEnv.id;

    const starterProject = await prisma.project.create({
      data: {
        name: 'default-project',
        userId: starterUserId,
      },
    });
    const starterEnv = await prisma.environment.create({
      data: {
        name: 'Production',
        projectId: starterProject.id,
      },
    });
    starterEnvId = starterEnv.id;
  });

  afterAll(async () => {
    // Cleanup
    const userIds = [freeUserId, starterUserId, proUserId].filter(Boolean) as string[];

    await prisma.subscription.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.service.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  });

  beforeEach(async () => {
    // Clean up services before each test
    await prisma.service.deleteMany({
      where: { userId: { in: [freeUserId, starterUserId, proUserId] } },
    });
  });

  describe('Service Count Limits', () => {
    it('should allow FREE user to create 1 service', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${freeAuthToken}`,
        },
        payload: {
          name: 'test-service-1',
          type: 'DOCKER',
          repoUrl: 'https://github.com/test/repo',
          environmentId: freeEnvId,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should block FREE user from creating 2nd service', async () => {
      // Create first service
      await prisma.service.create({
        data: {
          name: 'existing-service',
          userId: freeUserId,
          type: 'DOCKER',
          status: 'IDLE',
        },
      });

      // Try to create second service
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${freeAuthToken}`,
        },
        payload: {
          name: 'test-service-2',
          type: 'DOCKER',
          repoUrl: 'https://github.com/test/repo',
          environmentId: freeEnvId,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTH_FORBIDDEN');
      expect(body.error.message).toContain('Service limit reached');
    });

    it('should allow STARTER user to create 5 services', async () => {
      // Create 4 services first
      for (let i = 1; i <= 4; i++) {
        await prisma.service.create({
          data: {
            name: `service-${i}`,
            userId: starterUserId,
            type: 'DOCKER',
            status: 'IDLE',
          },
        });
      }

      // Create 5th service via API
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${starterAuthToken}`,
        },
        payload: {
          name: 'service-5',
          type: 'DOCKER',
          repoUrl: 'https://github.com/test/repo',
          environmentId: starterEnvId,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should block STARTER user from creating 6th service', async () => {
      // Create 5 services
      for (let i = 1; i <= 5; i++) {
        await prisma.service.create({
          data: {
            name: `service-${i}`,
            userId: starterUserId,
            type: 'DOCKER',
            status: 'IDLE',
          },
        });
      }

      // Try to create 6th service
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${starterAuthToken}`,
        },
        payload: {
          name: 'service-6',
          type: 'DOCKER',
          repoUrl: 'https://github.com/test/repo',
          environmentId: starterEnvId,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('Service limit reached');
      expect(body.error.message).toContain('STARTER');
      expect(body.error.message).toContain('5');
    });

    it('should not count deleted services towards limit', async () => {
      // Create and soft-delete a service
      await prisma.service.create({
        data: {
          name: 'deleted-service',
          userId: freeUserId,
          type: 'DOCKER',
          status: 'IDLE',
          deletedAt: new Date(),
        },
      });

      // Should be able to create a new service (deleted one doesn't count)
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${freeAuthToken}`,
        },
        payload: {
          name: 'new-service',
          type: 'DOCKER',
          repoUrl: 'https://github.com/test/repo',
          environmentId: freeEnvId,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Subscription Status Enforcement', () => {
    it('should block access for CANCELED subscription', async () => {
      // Update subscription to CANCELED
      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: { status: SubscriptionStatus.CANCELED },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${freeAuthToken}`,
        },
        payload: {
          name: 'test-service',
          type: 'DOCKER',
          environmentId: freeEnvId,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('canceled');

      // Restore status for other tests
      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: { status: SubscriptionStatus.ACTIVE },
      });
    });

    it('should block access for UNPAID subscription', async () => {
      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: { status: SubscriptionStatus.UNPAID },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${freeAuthToken}`,
        },
        payload: {
          name: 'test-service',
          type: 'DOCKER',
          environmentId: freeEnvId,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('unpaid');

      // Restore
      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: { status: SubscriptionStatus.ACTIVE },
      });
    });

    it('should allow access for PAST_DUE within grace period', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: threeDaysAgo,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${freeAuthToken}`,
        },
        payload: {
          name: 'test-service',
          type: 'DOCKER',
          repoUrl: 'https://github.com/test/repo',
          environmentId: freeEnvId,
        },
      });

      expect(response.statusCode).toBe(200);

      // Restore
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: futureDate,
        },
      });
    });

    it('should block access for PAST_DUE beyond grace period', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: tenDaysAgo,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${freeAuthToken}`,
        },
        payload: {
          name: 'test-service',
          type: 'DOCKER',
          environmentId: freeEnvId,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('past due');

      // Restore
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: futureDate,
        },
      });
    });

    it('should allow access to other routes with expired subscription (only blocks service operations)', async () => {
      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: { status: SubscriptionStatus.CANCELED },
      });

      // Should be able to list services (read operation)
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${freeAuthToken}`,
        },
      });

      // This should succeed as GET /services doesn't have subscription middleware
      expect(response.statusCode).toBe(200);

      // Restore
      await prisma.subscription.updateMany({
        where: { userId: freeUserId },
        data: { status: SubscriptionStatus.ACTIVE },
      });
    });
  });
});
