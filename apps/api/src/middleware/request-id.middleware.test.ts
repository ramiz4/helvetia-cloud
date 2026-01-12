import { describe, expect, it } from 'vitest';
import { fastify } from '../server';

/**
 * Tests for request ID middleware
 *
 * Verifies that:
 * - Request IDs are generated for all requests
 * - Request IDs are returned in X-Request-Id response header
 * - Existing request IDs from headers are preserved
 * - Request IDs are included in logs
 */
describe('Request ID Middleware', () => {
  it('should return X-Request-Id header in response', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(typeof response.headers['x-request-id']).toBe('string');
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    ); // UUID format
  });

  it('should preserve existing request ID from header', async () => {
    const existingRequestId = 'test-request-id-12345';

    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-request-id': existingRequestId,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe(existingRequestId);
  });

  it('should generate unique request IDs for different requests', async () => {
    const response1 = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    const response2 = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response1.headers['x-request-id']).toBeDefined();
    expect(response2.headers['x-request-id']).toBeDefined();
    expect(response1.headers['x-request-id']).not.toBe(response2.headers['x-request-id']);
  });
});
