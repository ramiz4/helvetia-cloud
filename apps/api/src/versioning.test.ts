import { prisma } from 'database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from './server';

// Skip these integration tests if DATABASE_URL is not set
// These tests require a real database to run
const shouldSkip = !process.env.DATABASE_URL;
const describeIf = shouldSkip ? describe.skip : describe;

/**
 * API Versioning Tests
 *
 * Tests to ensure:
 * 1. v1 routes are accessible under /api/v1 prefix
 * 2. Unversioned routes (health, metrics) remain accessible
 * 3. Authentication works with versioned routes
 * 4. Public routes work without authentication
 */
describeIf('API Versioning', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Clean up any existing test user
    await prisma.user.deleteMany({
      where: { githubId: 'test-gh-versioning' },
    });

    // Create a test user for authenticated requests
    const testUser = await prisma.user.create({
      data: {
        username: 'versioning-test-user',
        githubId: 'test-gh-versioning',
      },
    });
    testUserId = testUser.id;

    // Generate JWT token for auth
    authToken = app.jwt.sign({ id: testUserId, username: testUser.username });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await prisma.service.deleteMany({ where: { userId: testUserId } }).catch((error) => {
        console.error('Failed to cleanup test services:', error);
      });
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch((error) => {
        console.error('Failed to cleanup test user:', error);
      });
    }
    await app.close();
  });

  describe('Unversioned Endpoints', () => {
    it('should access health check without version prefix', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
    });

    it('should access metrics without version prefix', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    });

    it('should access JSON metrics without version prefix', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('v1 Authenticated Endpoints', () => {
    it('should access services endpoint with v1 prefix', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const services = JSON.parse(response.body);
      expect(Array.isArray(services)).toBe(true);
    });

    it('should require authentication for protected v1 endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/services',
      });

      expect(response.statusCode).toBe(401);
      const errorResponse = JSON.parse(response.body);
      expect(errorResponse.error.message).toBe('Authentication required');
    });

    it('should access projects endpoint with v1 prefix', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const projects = JSON.parse(response.body);
      expect(Array.isArray(projects)).toBe(true);
    });
  });

  describe('v1 Public Endpoints', () => {
    it('should access GitHub auth endpoint without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/github',
        payload: {
          code: 'test-code',
        },
      });

      // Should not return 401 (should fail with different error since code is invalid)
      expect(response.statusCode).not.toBe(401);
    });

    it('should access auth refresh endpoint without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
      });

      // Should not return 401 (should fail with different error since no refresh token)
      expect(response.statusCode).not.toBe(401);
    });

    it('should access auth logout endpoint without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      // Should not return 401
      expect(response.statusCode).not.toBe(401);
    });

    it('should access webhook endpoint without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/github',
        payload: {
          action: 'push',
        },
      });

      // Should not return 401 (should fail with different error)
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('Route Not Found', () => {
    it('should return 404 for unversioned API routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/services',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent v1 routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/non-existent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Version Prefix Consistency', () => {
    it('should use v1 prefix for all main API routes', async () => {
      const endpoints = [
        { method: 'GET', url: '/api/v1/services' },
        { method: 'GET', url: '/api/v1/projects' },
        { method: 'GET', url: '/api/v1/github/orgs' },
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        // Should not return 404 (route exists)
        expect(response.statusCode).not.toBe(404);
      }
    });
  });
});
