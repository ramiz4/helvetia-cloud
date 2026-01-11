import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors';

/**
 * List of routes that don't require authentication
 */
export const PUBLIC_ROUTES = [
  '/health',
  '/webhooks/github',
  '/auth/github',
  '/auth/refresh',
  '/auth/logout',
];

/**
 * Authentication middleware
 * Verifies JWT token for protected routes
 */
export const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
  const isPublicRoute = PUBLIC_ROUTES.includes(request.routeOptions?.url || '');

  if (isPublicRoute) {
    return;
  }

  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError('Authentication required');
  }
};

/**
 * Utility function to validate token without throwing
 * Used for SSE connections to check token expiration
 */
export async function validateToken(request: FastifyRequest): Promise<boolean> {
  try {
    await request.jwtVerify();
    return true;
  } catch {
    return false;
  }
}
