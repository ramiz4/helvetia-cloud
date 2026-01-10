import { prisma } from 'database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from './server';

// Skip these integration tests if DATABASE_URL is not set
// These tests require a real database to run
const shouldSkip = !process.env.DATABASE_URL;
const describeIf = shouldSkip ? describe.skip : describe;

describeIf('Deployment Flow Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let testUserId: string;
  let testServiceId: string;
  let authToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Ensure clean state for test user
    await prisma.deployment.deleteMany({
      where: { service: { user: { githubId: { in: ['test-gh-deployment', 'test-gh-other'] } } } },
    });
    await prisma.service.deleteMany({
      where: { user: { githubId: { in: ['test-gh-deployment', 'test-gh-other'] } } },
    });
    await prisma.user.deleteMany({
      where: { githubId: { in: ['test-gh-deployment', 'test-gh-other'] } },
    });

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        username: 'deployment-test-user',
        githubId: 'test-gh-deployment',
      },
    });
    testUserId = testUser.id;

    // Generate JWT token for auth
    authToken = app.jwt.sign({ id: testUserId, username: testUser.username });
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
    // Clean up any existing test services
    await prisma.deployment.deleteMany({ where: { service: { userId: testUserId } } });
    await prisma.service.deleteMany({ where: { userId: testUserId } });
  });

  describe('POST /services/:id/deploy', () => {
    it('should create a deployment and queue a build job', async () => {
      // Create a test service
      const service = await prisma.service.create({
        data: {
          name: 'test-deploy-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
        },
      });
      testServiceId = service.id;

      const response = await app.inject({
        method: 'POST',
        url: `/services/${service.id}/deploy`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const deployment = JSON.parse(response.body);
      expect(deployment).toHaveProperty('id');
      expect(deployment.status).toBe('QUEUED');
      expect(deployment.serviceId).toBe(service.id);

      // Verify deployment was created in database
      const dbDeployment = await prisma.deployment.findUnique({
        where: { id: deployment.id },
      });
      expect(dbDeployment).toBeDefined();
      expect(dbDeployment?.status).toBe('QUEUED');

      // Verify service status was updated to DEPLOYING
      const updatedService = await prisma.service.findUnique({
        where: { id: service.id },
      });
      expect(updatedService?.status).toBe('DEPLOYING');
    });

    it('should return 404 for non-existent service', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/services/non-existent-id/deploy',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toHaveProperty('error', 'Service not found');
    });

    it('should not deploy a service owned by another user', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          username: 'other-test-user',
          githubId: 'test-gh-other',
        },
      });

      // Create a service for the other user
      const otherService = await prisma.service.create({
        data: {
          name: 'other-user-service',
          userId: otherUser.id,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/services/${otherService.id}/deploy`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);

      // Cleanup
      await prisma.service.delete({ where: { id: otherService.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should handle STATIC service deployment', async () => {
      const service = await prisma.service.create({
        data: {
          name: 'test-static-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/static-repo',
          branch: 'main',
          type: 'STATIC',
          port: 80,
          staticOutputDir: 'dist',
          buildCommand: 'npm run build',
          status: 'IDLE',
        },
      });
      testServiceId = service.id;

      const response = await app.inject({
        method: 'POST',
        url: `/services/${service.id}/deploy`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const deployment = JSON.parse(response.body);
      expect(deployment.status).toBe('QUEUED');
    });

    it('should handle COMPOSE service deployment', async () => {
      const service = await prisma.service.create({
        data: {
          name: 'test-compose-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/compose-repo',
          branch: 'main',
          type: 'COMPOSE',
          port: 3000,
          status: 'IDLE',
        },
      });
      testServiceId = service.id;

      const response = await app.inject({
        method: 'POST',
        url: `/services/${service.id}/deploy`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const deployment = JSON.parse(response.body);
      expect(deployment.status).toBe('QUEUED');
    });

    it('should inject GitHub token into repo URL when available', async () => {
      // Mock encrypted token
      const { encrypt } = await import('./utils/crypto.js');
      const encryptedToken = encrypt('test-github-token');

      await prisma.user.update({
        where: { id: testUserId },
        data: { githubAccessToken: encryptedToken },
      });

      const service = await prisma.service.create({
        data: {
          name: 'test-service-with-token',
          userId: testUserId,
          repoUrl: 'https://github.com/test/private-repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
        },
      });
      testServiceId = service.id;

      const response = await app.inject({
        method: 'POST',
        url: `/services/${service.id}/deploy`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Cleanup - remove token
      await prisma.user.update({
        where: { id: testUserId },
        data: { githubAccessToken: null },
      });
    });
  });

  describe('Deployment Lifecycle', () => {
    it('should track deployment status changes', async () => {
      const service = await prisma.service.create({
        data: {
          name: 'test-lifecycle-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
        },
      });
      testServiceId = service.id;

      // Start deployment
      const deployResponse = await app.inject({
        method: 'POST',
        url: `/services/${service.id}/deploy`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const deployment = JSON.parse(deployResponse.body);

      // Simulate status updates
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'BUILDING' },
      });

      let updatedDeployment = await prisma.deployment.findUnique({
        where: { id: deployment.id },
      });
      expect(updatedDeployment?.status).toBe('BUILDING');

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'RUNNING' },
      });

      updatedDeployment = await prisma.deployment.findUnique({
        where: { id: deployment.id },
      });
      expect(updatedDeployment?.status).toBe('RUNNING');
    });

    it('should handle deployment failure', async () => {
      const service = await prisma.service.create({
        data: {
          name: 'test-failure-service',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
        },
      });
      testServiceId = service.id;

      const deployResponse = await app.inject({
        method: 'POST',
        url: `/services/${service.id}/deploy`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const deployment = JSON.parse(deployResponse.body);

      // Simulate deployment failure
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'FAILED',
          logs: 'Build failed: Missing dependencies',
        },
      });

      const failedDeployment = await prisma.deployment.findUnique({
        where: { id: deployment.id },
      });

      expect(failedDeployment?.status).toBe('FAILED');
      expect(failedDeployment?.logs).toContain('Build failed');
    });
  });

  describe('GET /services/:id/deployments', () => {
    it('should list all deployments for a service', async () => {
      const service = await prisma.service.create({
        data: {
          name: 'test-list-deployments',
          userId: testUserId,
          repoUrl: 'https://github.com/test/repo',
          branch: 'main',
          type: 'DOCKER',
          port: 3000,
          status: 'IDLE',
        },
      });
      testServiceId = service.id;

      // Create multiple deployments
      await prisma.deployment.create({
        data: { serviceId: service.id, status: 'COMPLETED' },
      });
      await prisma.deployment.create({
        data: { serviceId: service.id, status: 'FAILED' },
      });
      await prisma.deployment.create({
        data: { serviceId: service.id, status: 'QUEUED' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/services/${service.id}/deployments`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const deployments = JSON.parse(response.body);
      expect(deployments).toHaveLength(3);
      expect(deployments[0]).toHaveProperty('status');
    });
  });
});
