import crypto from 'crypto';
import { prisma } from 'database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from './server';

// Skip these integration tests if DATABASE_URL is not set
// These tests require a real database to run
const shouldSkip = !process.env.DATABASE_URL;
const describeIf = shouldSkip ? describe.skip : describe;

describeIf('Webhook Processing Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let testUserId: string;
  let testServiceId: string;
  let testProjectId: string;
  let testEnvironmentId: string;
  const webhookSecret = 'test-webhook-secret-12345';

  // Helper function to generate GitHub webhook signature
  function generateGitHubSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  beforeAll(async () => {
    // Set webhook secret in environment
    process.env.GITHUB_WEBHOOK_SECRET = webhookSecret;

    app = await buildServer();
    await app.ready();

    // Ensure clean state for test user
    await prisma.deployment.deleteMany({
      where: { service: { user: { githubId: 'test-gh-webhook' } } },
    });
    await prisma.service.deleteMany({ where: { user: { githubId: 'test-gh-webhook' } } });
    await prisma.user.deleteMany({ where: { githubId: 'test-gh-webhook' } });

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        username: 'webhook-test-user',
        githubId: 'test-gh-webhook',
      },
    });
    testUserId = testUser.id;

    // Create test project and environment
    const testProject = await prisma.project.create({
      data: {
        name: 'webhook-test-project',
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
  });

  afterAll(async () => {
    // Cleanup test data
    if (testServiceId) {
      await prisma.deployment.deleteMany({ where: { serviceId: testServiceId } }).catch(() => {});
      await prisma.service.deleteMany({ where: { id: testServiceId } }).catch(() => {});
    }
    if (testUserId) {
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

  describe('Webhook Signature Verification', () => {
    it('should reject webhook without signature', async () => {
      const payload = { test: 'data' };

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        payload,
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Missing signature');
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = { test: 'data' };
      const payloadString = JSON.stringify(payload);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': 'sha256=invalidsignature',
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Invalid signature');
    });

    it('should accept webhook with valid signature', async () => {
      const payload = {
        repository: { html_url: 'https://github.com/webhook-test/repo' },
        ref: 'refs/heads/main',
        after: 'abc123',
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      // Should not be 401 (unauthorized)
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('Push Webhook Processing', () => {
    it('should trigger deployment for matching service on push', async () => {
      // Create a service matching the webhook
      const service = await prisma.service.create({
        data: {
          name: 'test-push-service',
          userId: testUserId,
          repoUrl: 'https://github.com/webhook-test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
          environmentId: testEnvironmentId,
          isPreview: false,
        },
      });
      testServiceId = service.id;

      const payload = {
        repository: { html_url: 'https://github.com/webhook-test/repo' },
        ref: 'refs/heads/main',
        after: 'abc123def456',
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.success).toBe(true);
      expect(result.servicesTriggered).toBe(1);

      // Verify a deployment was created
      const deployments = await prisma.deployment.findMany({
        where: { serviceId: service.id },
      });
      expect(deployments.length).toBeGreaterThan(0);
    });

    it('should skip push webhook for non-matching branch', async () => {
      const service = await prisma.service.create({
        data: {
          name: 'test-branch-mismatch',
          userId: testUserId,
          repoUrl: 'https://github.com/webhook-test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
          environmentId: testEnvironmentId,
          isPreview: false,
        },
      });
      testServiceId = service.id;

      const payload = {
        repository: { html_url: 'https://github.com/webhook-test/repo' },
        ref: 'refs/heads/develop', // Different branch
        after: 'abc123def456',
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.skipped).toBeDefined();

      // Verify no deployment was created
      const deployments = await prisma.deployment.findMany({
        where: { serviceId: service.id },
      });
      expect(deployments).toHaveLength(0);
    });

    it('should skip push webhook for non-existent service', async () => {
      const payload = {
        repository: { html_url: 'https://github.com/nonexistent/repo' },
        ref: 'refs/heads/main',
        after: 'abc123def456',
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.skipped).toContain('No matching service found');
    });

    it('should not trigger preview services on push', async () => {
      // Create a preview service
      await prisma.service.create({
        data: {
          name: 'test-push-preview',
          userId: testUserId,
          repoUrl: 'https://github.com/webhook-test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
          environmentId: testEnvironmentId,
          isPreview: true,
          prNumber: 123,
        },
      });

      const payload = {
        repository: { html_url: 'https://github.com/webhook-test/repo' },
        ref: 'refs/heads/main',
        after: 'abc123def456',
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.skipped).toBeDefined();
    });
  });

  describe('Pull Request Webhook Processing', () => {
    it('should create preview environment on PR opened', async () => {
      // Create a base service
      const baseService = await prisma.service.create({
        data: {
          name: 'test-base-service',
          userId: testUserId,
          repoUrl: 'https://github.com/webhook-test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
          environmentId: testEnvironmentId,
          isPreview: false,
        },
      });
      testServiceId = baseService.id;

      const payload = {
        action: 'opened',
        number: 42,
        pull_request: {
          number: 42,
          head: {
            ref: 'feature-branch',
            sha: 'feature123abc',
          },
          base: {
            repo: {
              html_url: 'https://github.com/webhook-test/repo',
            },
          },
        },
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.success).toBe(true);
      expect(result.previewService).toBe('test-base-service-pr-42');

      // Verify preview service was created
      const previewService = await prisma.service.findFirst({
        where: {
          name: 'test-base-service-pr-42',
          isPreview: true,
          prNumber: 42,
        },
      });
      expect(previewService).toBeDefined();
      expect(previewService?.branch).toBe('feature-branch');
    });

    it('should update preview environment on PR synchronize', async () => {
      // Create a base service
      const baseService = await prisma.service.create({
        data: {
          name: 'test-sync-base',
          userId: testUserId,
          repoUrl: 'https://github.com/webhook-test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
          environmentId: testEnvironmentId,
          isPreview: false,
        },
      });

      // Create existing preview service
      const previewService = await prisma.service.create({
        data: {
          name: 'test-sync-base-pr-43',
          userId: testUserId,
          repoUrl: 'https://github.com/webhook-test/repo',
          branch: 'old-feature-branch',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
          environmentId: testEnvironmentId,
          isPreview: true,
          prNumber: 43,
        },
      });

      const payload = {
        action: 'synchronize',
        number: 43,
        pull_request: {
          number: 43,
          head: {
            ref: 'updated-feature-branch',
            sha: 'updated123abc',
          },
          base: {
            repo: {
              html_url: 'https://github.com/webhook-test/repo',
            },
          },
        },
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.success).toBe(true);

      // Verify preview service was updated
      const updatedPreview = await prisma.service.findUnique({
        where: { id: previewService.id },
      });
      expect(updatedPreview?.branch).toBe('updated-feature-branch');

      // Cleanup
      await prisma.deployment
        .deleteMany({ where: { serviceId: { in: [baseService.id, previewService.id] } } })
        .catch(() => {});
      await prisma.service
        .deleteMany({ where: { id: { in: [baseService.id, previewService.id] } } })
        .catch(() => {});
    });

    it('should delete preview environment on PR closed', async () => {
      // Create a base service
      const baseService = await prisma.service.create({
        data: {
          name: 'test-close-base',
          userId: testUserId,
          repoUrl: 'https://github.com/webhook-test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
          environmentId: testEnvironmentId,
          isPreview: false,
        },
      });

      // Create preview service
      const previewService = await prisma.service.create({
        data: {
          name: 'test-close-base-pr-44',
          userId: testUserId,
          repoUrl: 'https://github.com/webhook-test/repo',
          branch: 'feature-branch',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
          environmentId: testEnvironmentId,
          isPreview: true,
          prNumber: 44,
        },
      });

      const payload = {
        action: 'closed',
        number: 44,
        pull_request: {
          number: 44,
          head: {
            ref: 'feature-branch',
            sha: 'feature123abc',
          },
          base: {
            repo: {
              html_url: 'https://github.com/webhook-test/repo',
            },
          },
        },
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.success).toBe(true);
      expect(result.deletedService).toBe('test-close-base-pr-44');

      // Verify preview service was soft-deleted
      const deletedPreview = await prisma.service.findUnique({
        where: { id: previewService.id },
      });
      expect(deletedPreview?.deletedAt).not.toBeNull();

      // Cleanup
      await prisma.deployment
        .deleteMany({ where: { serviceId: { in: [baseService.id, previewService.id] } } })
        .catch(() => {});
      await prisma.service
        .deleteMany({ where: { id: { in: [baseService.id, previewService.id] } } })
        .catch(() => {});
    });

    it('should skip PR webhook when no base service exists', async () => {
      const payload = {
        action: 'opened',
        number: 45,
        pull_request: {
          number: 45,
          head: {
            ref: 'feature-branch',
            sha: 'feature123abc',
          },
          base: {
            repo: {
              html_url: 'https://github.com/nonexistent/repo',
            },
          },
        },
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.skipped).toContain('No base service found');
    });

    it('should ignore PR actions that are not handled', async () => {
      const payload = {
        action: 'labeled', // Not a handled action
        number: 46,
        pull_request: {
          number: 46,
          head: {
            ref: 'feature-branch',
            sha: 'feature123abc',
          },
          base: {
            repo: {
              html_url: 'https://github.com/webhook-test/repo',
            },
          },
        },
      };
      const payloadString = JSON.stringify(payload);
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.skipped).toContain('Action labeled not handled');
    });
  });

  describe('Webhook Error Handling', () => {
    it('should handle malformed webhook payload gracefully', async () => {
      const payloadString = 'not a valid json';
      const signature = generateGitHubSignature(payloadString, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      // Should return error but not crash
      expect([400, 500]).toContain(response.statusCode);
    });

    it('should handle missing webhook secret gracefully', async () => {
      const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
      delete process.env.GITHUB_WEBHOOK_SECRET;

      const payload = { test: 'data' };
      const payloadString = JSON.stringify(payload);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': 'sha256=test',
          'content-type': 'application/json',
        },
        payload: payloadString,
      });

      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Webhook secret not configured');

      // Restore
      process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
    });
  });
});
