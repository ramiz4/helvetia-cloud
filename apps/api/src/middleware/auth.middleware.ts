import { Role } from 'database';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors/index.js';

/**
 * List of routes that don't require authentication
 */
export const PUBLIC_ROUTES = [
  '/health',
  '/metrics',
  '/metrics/json',
  '/webhooks/github',
  '/webhooks/stripe',
  '/auth/github',
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/feature-flags/check',
  '/feature-flags/check-bulk',
  '/terms/latest',
  '/terms/version',
  '/terms/versions',
  '/privacy-policy/latest',
  '/privacy-policy/version',
  '/privacy-policy/versions',
];

/**
 * Check if a route is public (doesn't require authentication)
 * Handles both versioned (/api/v1/...) and unversioned routes
 */
export function isPublicRoute(url: string): boolean {
  // Normalize URL by removing query parameters
  const path = url.split('?')[0];

  // Check if the route itself is public
  if (PUBLIC_ROUTES.includes(path)) {
    return true;
  }

  // Handle Swagger documentation routes
  if (
    path === '/api/v1/docs' ||
    path.startsWith('/api/v1/docs/') ||
    path.startsWith('/api/v1/docs/static/')
  ) {
    return true;
  }

  // Check if it's a versioned public route (e.g., /api/v1/auth/refresh)
  for (const publicRoute of PUBLIC_ROUTES) {
    if (
      path === `/api/v1${publicRoute}` ||
      path === `/api/v1${publicRoute}/` ||
      path.startsWith(`/api/v1${publicRoute}/`)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Authentication middleware
 * Verifies JWT token for protected routes
 */
export const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
  const routeUrl = request.routeOptions?.url || '';

  if (isPublicRoute(routeUrl)) {
    return;
  }

  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError('Authentication required');
  }
};

/**
 * Admin role required middleware
 * Verifies that the authenticated user has ADMIN role
 */
export const requireAdmin = async (request: FastifyRequest, _reply: FastifyReply) => {
  // First ensure they are authenticated
  await authenticate(request, _reply);

  // Then check the role
  if (request.user?.role !== Role.ADMIN) {
    throw new UnauthorizedError('Admin privileges required');
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
