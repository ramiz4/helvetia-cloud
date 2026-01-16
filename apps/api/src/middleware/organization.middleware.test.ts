import { Role } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../di/tokens';
import { ForbiddenError } from '../errors';
import type { OrganizationService } from '../services/OrganizationService';
import { requireOrganizationPermission, requireOrganizationRole } from './organization.middleware';

/**
 * Tests for organization middleware
 *
 * Verifies that:
 * - Permission checks work correctly based on role hierarchy
 * - Only users with sufficient roles can access protected routes
 * - Non-members are rejected
 * - Invalid organization IDs are handled
 */
describe('Organization Middleware', () => {
  let mockOrganizationService: OrganizationService;
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    mockOrganizationService = {
      getRole: vi.fn(),
    } as any;

    // Mock the DI container
    vi.mock('../di', () => ({
      resolve: vi.fn((token) => {
        if (token === TOKENS.OrganizationService) {
          return mockOrganizationService;
        }
        return null;
      }),
      TOKENS,
    }));

    mockRequest = {
      user: { id: 'user-123' },
      params: { id: 'org-123' },
    };

    mockReply = {};
  });

  describe('requireOrganizationRole', () => {
    it('should allow access when user has required role', async () => {
      vi.mocked(mockOrganizationService.getRole).mockResolvedValue(Role.ADMIN);

      const middleware = requireOrganizationRole([Role.ADMIN, Role.OWNER]);
      await expect(middleware(mockRequest, mockReply)).resolves.not.toThrow();
    });

    it('should deny access when user does not have required role', async () => {
      vi.mocked(mockOrganizationService.getRole).mockResolvedValue(Role.VIEWER);

      const middleware = requireOrganizationRole([Role.ADMIN, Role.OWNER]);
      await expect(middleware(mockRequest, mockReply)).rejects.toThrow(ForbiddenError);
    });

    it('should deny access when user is not a member', async () => {
      vi.mocked(mockOrganizationService.getRole).mockResolvedValue(null);

      const middleware = requireOrganizationRole([Role.ADMIN]);
      await expect(middleware(mockRequest, mockReply)).rejects.toThrow(ForbiddenError);
    });

    it('should reject invalid organization IDs', async () => {
      mockRequest.params.id = 'invalid-id';

      const middleware = requireOrganizationRole([Role.ADMIN]);
      await expect(middleware(mockRequest, mockReply)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('requireOrganizationPermission', () => {
    it('should allow OWNER to access ADMIN-required routes', async () => {
      vi.mocked(mockOrganizationService.getRole).mockResolvedValue(Role.OWNER);

      const middleware = requireOrganizationPermission(Role.ADMIN);
      await expect(middleware(mockRequest, mockReply)).resolves.not.toThrow();
    });

    it('should allow ADMIN to access DEVELOPER-required routes', async () => {
      vi.mocked(mockOrganizationService.getRole).mockResolvedValue(Role.ADMIN);

      const middleware = requireOrganizationPermission(Role.DEVELOPER);
      await expect(middleware(mockRequest, mockReply)).resolves.not.toThrow();
    });

    it('should deny VIEWER access to MEMBER-required routes', async () => {
      vi.mocked(mockOrganizationService.getRole).mockResolvedValue(Role.VIEWER);

      const middleware = requireOrganizationPermission(Role.MEMBER);
      await expect(middleware(mockRequest, mockReply)).rejects.toThrow(ForbiddenError);
    });

    it('should deny DEVELOPER access to ADMIN-required routes', async () => {
      vi.mocked(mockOrganizationService.getRole).mockResolvedValue(Role.DEVELOPER);

      const middleware = requireOrganizationPermission(Role.ADMIN);
      await expect(middleware(mockRequest, mockReply)).rejects.toThrow(ForbiddenError);
    });

    it('should deny non-members', async () => {
      vi.mocked(mockOrganizationService.getRole).mockResolvedValue(null);

      const middleware = requireOrganizationPermission(Role.MEMBER);
      await expect(middleware(mockRequest, mockReply)).rejects.toThrow(ForbiddenError);
    });
  });
});
