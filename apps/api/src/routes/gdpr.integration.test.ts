import { prisma } from 'database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../server';

// Skip these integration tests unless RUN_INTEGRATION_TESTS is set
const shouldSkip = process.env.RUN_INTEGRATION_TESTS !== '1';

describe.skipIf(shouldSkip)('GDPR Routes Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let testUserId: string;
  let testUsername: string;
  let authToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Build the server
    app = await buildServer();
    await app.ready();

    // Clean up any existing test data
    await prisma.project.deleteMany({
      where: { user: { githubId: 'test-gh-gdpr' } },
    });
    await prisma.user.deleteMany({
      where: { githubId: 'test-gh-gdpr' },
    });

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        username: 'gdpr-test-user',
        githubId: 'test-gh-gdpr',
      },
    });
    testUserId = testUser.id;
    testUsername = testUser.username;

    // Create test project
    const testProject = await prisma.project.create({
      data: {
        name: 'gdpr-test-project',
        userId: testUserId,
      },
    });
    testProjectId = testProject.id;

    // Generate auth token
    authToken = app.jwt.sign({ id: testUserId, username: testUsername, role: 'MEMBER' });
  });

  afterAll(async () => {
    // Clean up test data
    if (testProjectId) {
      await prisma.project.deleteMany({
        where: { id: testProjectId },
      });
    }
    if (testUserId) {
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    }
    await app.close();
  });

  beforeEach(() => {
    // Reset mocks between tests if needed
  });

  describe('GET /api/v1/gdpr/export', () => {
    it('should export user data successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/export',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      // Verify export structure
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('projects');
      expect(data).toHaveProperty('organizations');
      expect(data).toHaveProperty('exportDate');
      expect(data).toHaveProperty('dataTypes');

      // Verify user data
      expect(data.user.id).toBe(testUserId);
      expect(data.user.username).toBe(testUsername);
      expect(data.user.githubId).toBe('test-gh-gdpr');

      // Verify sensitive data is excluded
      expect(data.user).not.toHaveProperty('githubAccessToken');
      expect(data.user).not.toHaveProperty('password');

      // Verify projects are included
      expect(Array.isArray(data.projects)).toBe(true);
      expect(data.projects.length).toBeGreaterThan(0);
      expect(data.projects[0].name).toBe('gdpr-test-project');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/export',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent user', async () => {
      // Create a token for a non-existent user
      const fakeToken = app.jwt.sign({
        id: '00000000-0000-0000-0000-000000000000',
        username: 'fake-user',
        role: 'MEMBER',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/gdpr/export',
        headers: {
          authorization: `Bearer ${fakeToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('User not found');
    });
  });

  describe('DELETE /api/v1/gdpr/delete-account', () => {
    it('should reject deletion with wrong username confirmation', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/gdpr/delete-account',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          confirmUsername: 'wrong-username',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Username confirmation does not match');

      // Verify user still exists
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user).not.toBeNull();
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/gdpr/delete-account',
        payload: {
          confirmUsername: testUsername,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeToken = app.jwt.sign({
        id: '00000000-0000-0000-0000-000000000000',
        username: 'fake-user',
        role: 'MEMBER',
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/gdpr/delete-account',
        headers: {
          authorization: `Bearer ${fakeToken}`,
        },
        payload: {
          confirmUsername: 'fake-user',
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('User not found');
    });

    // Note: We don't test successful deletion here to avoid breaking other tests
    // The delete functionality should be tested in isolation or as the last test
  });
});
