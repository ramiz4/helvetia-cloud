import { prisma } from 'database';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../config/env';
import { buildServer } from '../server';
import {
  createSubscriptionFixture,
  createUsageRecordFixture,
  testStripePrices,
} from '../test/fixtures/billing.fixtures';
import { createMockStripe, resetMockStripe } from '../test/mocks/stripe.mock';

// Skip these integration tests unless RUN_INTEGRATION_TESTS is set
// These tests require a real database to run
// Set RUN_INTEGRATION_TESTS=1 to enable these tests
const shouldSkip = process.env.RUN_INTEGRATION_TESTS !== '1';

// Mock the stripe config
vi.mock('../config/stripe', () => ({
  getStripeClient: () => createMockStripe(),
  isStripeConfigured: () => true,
  getStripePriceIds: () => ({
    STARTER: testStripePrices.starter,
    PRO: testStripePrices.pro,
    ENTERPRISE: testStripePrices.enterprise,
  }),
}));

describe.skipIf(shouldSkip)('BillingController Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let testUserId: string;
  let authToken: string;
  let testServiceId: string;
  let testProjectId: string;
  let testEnvironmentId: string;
  let testOrganizationId: string;

  beforeAll(async () => {
    // Build the server
    app = await buildServer();
    await app.ready();

    // Clean up any existing test data
    await prisma.usageRecord.deleteMany({
      where: { service: { user: { githubId: 'test-gh-billing' } } },
    });
    await prisma.service.deleteMany({
      where: { user: { githubId: 'test-gh-billing' } },
    });
    await prisma.subscription.deleteMany({
      where: { user: { githubId: 'test-gh-billing' } },
    });
    await prisma.user.deleteMany({
      where: { githubId: 'test-gh-billing' },
    });

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        username: 'billing-test-user',
        githubId: 'test-gh-billing',
      },
    });
    testUserId = testUser.id;

    // Create test project and environment for services
    const testProject = await prisma.project.create({
      data: {
        name: 'billing-test-project',
        userId: testUserId,
      },
    });
    testProjectId = testProject.id;

    const testEnv = await prisma.environment.create({
      data: {
        name: 'production',
        projectId: testProjectId,
      },
    });
    testEnvironmentId = testEnv.id;

    // Create test organization
    const testOrg = await prisma.organization.create({
      data: {
        name: 'Test Billing Org',
        slug: 'test-billing-org',
      },
    });
    testOrganizationId = testOrg.id;

    // Add user as organization member
    await prisma.organizationMember.create({
      data: {
        organizationId: testOrganizationId,
        userId: testUserId,
        role: 'OWNER',
      },
    });

    // Generate JWT token for auth
    authToken = app.jwt.sign({ id: testUserId, username: testUser.username });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testServiceId) {
      await prisma.usageRecord.deleteMany({ where: { serviceId: testServiceId } }).catch(() => {});
      await prisma.service.deleteMany({ where: { id: testServiceId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.usageRecord
        .deleteMany({ where: { service: { userId: testUserId } } })
        .catch(() => {});
      await prisma.service.deleteMany({ where: { userId: testUserId } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { userId: testUserId } }).catch(() => {});
      await prisma.organizationMember.deleteMany({ where: { userId: testUserId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    }
    if (testOrganizationId) {
      await prisma.organization.deleteMany({ where: { id: testOrganizationId } }).catch(() => {});
    }
    if (app) await app.close();
  });

  beforeEach(async () => {
    // Reset mock Stripe data between tests
    resetMockStripe();

    // Clean up services, usage records, and subscriptions before each test
    await prisma.usageRecord.deleteMany({ where: { service: { userId: testUserId } } });
    await prisma.service.deleteMany({ where: { userId: testUserId } });
    await prisma.subscription.deleteMany({ where: { userId: testUserId } });
  });

  describe('GET /billing/subscription', () => {
    it('should return subscription for authenticated user', async () => {
      // Create a subscription for the test user
      const subscription = await prisma.subscription.create({
        data: createSubscriptionFixture({
          userId: testUserId,
          plan: 'STARTER',
          status: 'ACTIVE',
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/subscription',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe(subscription.id);
      expect(data.plan).toBe('STARTER');
      expect(data.status).toBe('ACTIVE');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/subscription',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 if user has no subscription', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/subscription',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('No subscription found');
    });
  });

  describe('POST /billing/checkout', () => {
    it('should create checkout session for valid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json',
        },
        payload: {
          priceId: testStripePrices.starter,
          plan: 'STARTER',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('sessionId');
      expect(data).toHaveProperty('url');
      expect(data.sessionId).toMatch(/^cs_test_/);
      expect(data.url).toContain('checkout.stripe.com');
    });

    it('should return 400 for missing priceId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json',
        },
        payload: {
          plan: 'STARTER',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      // Schema validation will return structured error
      expect(data).toBeDefined();
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: {
          priceId: testStripePrices.starter,
          plan: 'STARTER',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /billing/portal', () => {
    it('should create portal session for user with subscription', async () => {
      // Create subscription
      await prisma.subscription.create({
        data: createSubscriptionFixture({
          userId: testUserId,
          plan: 'STARTER',
          status: 'ACTIVE',
        }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/portal',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('url');
      expect(data.url).toContain('billing.stripe.com');
    });

    it('should return 404 if user has no subscription', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/portal',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('No subscription found');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/portal',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /billing/invoices', () => {
    it('should return invoices for user with subscription', async () => {
      // Create subscription
      await prisma.subscription.create({
        data: createSubscriptionFixture({
          userId: testUserId,
          plan: 'PRO',
          status: 'ACTIVE',
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/invoices',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('invoices');
      expect(Array.isArray(data.invoices)).toBe(true);
    });

    it('should return 404 if user has no subscription', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/invoices',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/invoices',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /billing/usage', () => {
    it('should return usage for current billing period', async () => {
      // Create subscription
      const subscription = await prisma.subscription.create({
        data: createSubscriptionFixture({
          userId: testUserId,
          plan: 'STARTER',
          status: 'ACTIVE',
        }),
      });

      // Create test service
      const service = await prisma.service.create({
        data: {
          name: 'test-usage-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'RUNNING',
          environmentId: testEnvironmentId,
        },
      });
      testServiceId = service.id;

      // Create usage records within the billing period
      await prisma.usageRecord.create({
        data: createUsageRecordFixture({
          serviceId: service.id,
          metric: 'COMPUTE_HOURS',
          quantity: 10,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/usage',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('usage');
      expect(data).toHaveProperty('periodStart');
      expect(data).toHaveProperty('periodEnd');
      expect(Array.isArray(data.usage)).toBe(true);
    });

    it('should return 404 if user has no subscription', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/usage',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /billing/usage/history', () => {
    beforeEach(async () => {
      // Create subscription for usage history tests
      await prisma.subscription.create({
        data: createSubscriptionFixture({
          userId: testUserId,
          plan: 'PRO',
          status: 'ACTIVE',
        }),
      });
    });

    it('should return usage history with default date range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/usage/history',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('usage');
      expect(data).toHaveProperty('periodStart');
      expect(data).toHaveProperty('periodEnd');
    });

    it('should return usage history with custom date range', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-31T23:59:59Z');

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/usage/history?periodStart=${startDate.toISOString()}&periodEnd=${endDate.toISOString()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(new Date(data.periodStart).getTime()).toBe(startDate.getTime());
      expect(new Date(data.periodEnd).getTime()).toBe(endDate.getTime());
    });

    it('should return 400 for invalid date format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/usage/history?periodStart=invalid-date',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      // Check for validation error (either schema or custom)
      expect(data.code || data.error).toBeDefined();
    });

    it('should return 400 when periodStart is after periodEnd', async () => {
      const startDate = new Date('2024-02-01T00:00:00Z');
      const endDate = new Date('2024-01-01T00:00:00Z');

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/usage/history?periodStart=${startDate.toISOString()}&periodEnd=${endDate.toISOString()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('periodStart must be before periodEnd');
    });

    it('should return 400 for future dates', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/usage/history?periodEnd=${futureDate.toISOString()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('periodEnd cannot be in the future');
    });

    it('should return 400 for date range exceeding 1 year', async () => {
      const startDate = new Date('2023-01-01T00:00:00Z');
      const endDate = new Date('2024-02-01T00:00:00Z');

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/usage/history?periodStart=${startDate.toISOString()}&periodEnd=${endDate.toISOString()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Date range cannot exceed 1 year');
    });

    it('should return usage history for organization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/usage/history?organizationId=${testOrganizationId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('usage');
    });

    it('should return 403 for unauthorized organization access', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/usage/history?organizationId=nonexistent-org',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Access denied to organization usage data');
    });
  });

  describe('GET /billing/usage/service/:id', () => {
    it('should return usage for service owned by user', async () => {
      // Create subscription
      await prisma.subscription.create({
        data: createSubscriptionFixture({
          userId: testUserId,
          plan: 'PRO',
          status: 'ACTIVE',
        }),
      });

      // Create test service
      const service = await prisma.service.create({
        data: {
          name: 'test-service-usage',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'RUNNING',
          environmentId: testEnvironmentId,
        },
      });
      testServiceId = service.id;

      // Create usage record
      await prisma.usageRecord.create({
        data: createUsageRecordFixture({
          serviceId: service.id,
          metric: 'COMPUTE_HOURS',
          quantity: 5,
        }),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/usage/service/${service.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('usage');
      expect(data).toHaveProperty('serviceId', service.id);
      expect(data).toHaveProperty('serviceName', service.name);
    });

    it('should return 404 for non-existent service', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/usage/service/nonexistent-service-id',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Service not found');
    });

    it('should return 403 for unauthorized service access', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          username: 'other-billing-user',
          githubId: 'test-gh-other-billing',
        },
      });

      // Create service for other user
      const otherService = await prisma.service.create({
        data: {
          name: 'other-user-service',
          userId: otherUser.id,
          repoUrl: 'https://github.com/test/other-repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'RUNNING',
          environmentId: testEnvironmentId,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/usage/service/${otherService.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Access denied to service usage data');

      // Cleanup
      await prisma.service.delete({ where: { id: otherService.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should validate date ranges', async () => {
      // Create service
      const service = await prisma.service.create({
        data: {
          name: 'test-date-validation',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'RUNNING',
          environmentId: testEnvironmentId,
        },
      });
      testServiceId = service.id;

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/usage/service/${service.id}?periodEnd=${futureDate.toISOString()}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('periodEnd cannot be in the future');
    });
  });

  describe('Stripe Webhook Integration', () => {
    const webhookSecret = 'whsec_test_secret_123';

    beforeAll(() => {
      // Set webhook secret
      process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
      env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    });

    // Note: These tests will fail webhook signature verification because
    // we're using a mock Stripe client. In a real scenario, we'd need to
    // properly construct Stripe webhook events or bypass signature verification
    // for testing. For now, we test that endpoints exist and respond appropriately.

    // Note: Stripe webhook endpoint may require special handling or different routing
    // These tests verify the endpoint exists and handles requests appropriately
    it('should reject webhook with invalid signature', async () => {
      const payload = JSON.stringify({ type: 'test.event' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/stripe',
        headers: {
          'stripe-signature': 'invalid-signature',
          'content-type': 'application/json',
        },
        payload,
      });

      // May return 401 or 400 depending on routing configuration
      expect([400, 401]).toContain(response.statusCode);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    it('should reject webhook without signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/stripe',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ type: 'test.event' }),
      });

      // May return 401 or 400 depending on routing configuration
      expect([400, 401]).toContain(response.statusCode);
      const data = JSON.parse(response.body);
      expect(data.error).toBeDefined();
    });

    // Webhook event processing tests would require either:
    // 1. Mocking Stripe.webhooks.constructEvent
    // 2. Using actual Stripe webhook secrets and proper signature generation
    // 3. Bypassing signature verification in test mode
    // For comprehensive webhook testing, consider unit tests on StripeWebhookController
    // with mocked services instead of integration tests
  });
});
