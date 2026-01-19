import type { Role } from 'database';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { resolve, TOKENS } from '../di/index.js';
import { ForbiddenError, ValidationError } from '../errors/index.js';
import type { OrganizationService } from '../services/OrganizationService.js';

/**
 * Get role hierarchy dynamically to avoid top-level imports
 */
function getRoleHierarchy(): Record<string, number> {
  // Import Role enum dynamically
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Role } = require('database');
  return {
    [Role.OWNER]: 100,
    [Role.ADMIN]: 80,
    [Role.DEVELOPER]: 60,
    [Role.MEMBER]: 40,
    [Role.VIEWER]: 20,
  };
}

/**
 * Check if user has permission for an organization
 * Requires organizationId in route params
 */
export const requireOrganizationRole = (allowedRoles: Role[]) => {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const organizationService = resolve<OrganizationService>(TOKENS.OrganizationService);

    // Extract organization ID from params
    const paramsSchema = z.object({ id: z.string().uuid() });
    const parseResult = paramsSchema.safeParse(request.params);

    if (!parseResult.success) {
      throw new ValidationError('Invalid organization ID');
    }

    const { id: organizationId } = parseResult.data;
    const userId = request.user.id;

    // Get user's role in the organization
    const userRole = await organizationService.getRole(organizationId, userId);

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
  };
};

/**
 * Check if user has at least a certain permission level
 * Uses role hierarchy (OWNER > ADMIN > DEVELOPER > MEMBER > VIEWER)
 */
export const requireOrganizationPermission = (minimumRole: Role) => {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const organizationService = resolve<OrganizationService>(TOKENS.OrganizationService);
    const ROLE_HIERARCHY = getRoleHierarchy();

    // Extract organization ID from params
    const paramsSchema = z.object({ id: z.string().uuid() });
    const parseResult = paramsSchema.safeParse(request.params);

    if (!parseResult.success) {
      throw new ValidationError('Invalid organization ID');
    }

    const { id: organizationId } = parseResult.data;
    const userId = request.user.id;

    // Get user's role in the organization
    const userRole = await organizationService.getRole(organizationId, userId);

    if (!userRole) {
      throw new ForbiddenError('You are not a member of this organization');
    }

    // Check if user has sufficient permissions
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minimumRole]) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
};
