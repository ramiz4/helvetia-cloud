import type { FastifyRequest } from 'fastify';

/**
 * Helper to validate JWT token from request
 */
export async function validateToken(request: FastifyRequest): Promise<boolean> {
  try {
    // Try to verify the JWT token
    await request.jwtVerify();
    return true;
  } catch (error) {
    // Token is invalid or expired
    console.log('Token validation failed:', (error as Error).message);
    return false;
  }
}
