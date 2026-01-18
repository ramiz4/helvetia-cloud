import { prisma } from 'database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../server';

// Skip these integration tests unless RUN_INTEGRATION_TESTS is set
const shouldSkip = process.env.RUN_INTEGRATION_TESTS !== '1';

describe.skipIf(shouldSkip)('PrivacyPolicyController Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let testUserId: string;
  let authToken: string;
  let privacyPolicyId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Cleanup
    await prisma.userTermsAcceptance.deleteMany({
      where: { user: { githubId: 'test-gh-privacy' } },
    });
    await prisma.userPrivacyPolicyAcceptance.deleteMany({
      where: { user: { githubId: 'test-gh-privacy' } },
    });
    await prisma.privacyPolicyVersion.deleteMany({});
    await prisma.user.deleteMany({ where: { githubId: 'test-gh-privacy' } });

    // Create User
    const user = await prisma.user.create({
      data: {
        username: 'privacy-test-user',
        githubId: 'test-gh-privacy',
      },
    });
    testUserId = user.id;
    authToken = app.jwt.sign({ id: user.id, username: user.username });

    // Create Policy
    const policy = await prisma.privacyPolicyVersion.create({
      data: {
        version: '1.0.0',
        content: 'Test Content',
        language: 'en',
        effectiveAt: new Date(),
      },
    });
    privacyPolicyId = policy.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.userPrivacyPolicyAcceptance.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    await prisma.privacyPolicyVersion.deleteMany({});
    await app.close();
  });

  describe('GET /privacy-policy/latest', () => {
    it('should return latest policy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/privacy-policy/latest?language=en',
      });
      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.version).toBe('1.0.0');
    });

    it('should return 404 for unknown language', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/privacy-policy/latest?language=unknown',
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /privacy-policy/check-acceptance', () => {
    it('should return requiresAcceptance true initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/privacy-policy/check-acceptance',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.requiresAcceptance).toBe(true);
    });
  });

  describe('POST /privacy-policy/accept', () => {
    it('should accept policy', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/privacy-policy/accept',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { privacyPolicyVersionId: privacyPolicyId },
      });
      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
    });

    it('should return requiresAcceptance false after accepting', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/privacy-policy/check-acceptance',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.requiresAcceptance).toBe(false);
    });
  });
});
