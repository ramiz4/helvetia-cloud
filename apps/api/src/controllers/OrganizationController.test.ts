import 'reflect-metadata';
import { ForbiddenError, NotFoundError, ValidationError } from 'shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationService } from '../services/OrganizationService.js';
import { OrganizationController } from './OrganizationController.js';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let mockOrganizationService: any;
  let mockRequest: any;
  let mockReply: any;

  const mockOrg = {
    id: 'org-1-uuid',
    name: 'Test Org',
    slug: 'test-org',
    userId: 'user-1-uuid',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMember = {
    id: 'member-1-uuid',
    organizationId: 'org-1-uuid',
    userId: 'user-2-uuid',
    role: 'MEMBER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockOrganizationService = {
      createOrganization: vi.fn(),
      getUserOrganizations: vi.fn(),
      getOrganizationById: vi.fn(),
      addMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
    };

    controller = new OrganizationController(mockOrganizationService as OrganizationService);

    mockRequest = {
      params: {},
      body: {},
      user: { id: 'user-1-uuid' },
      log: {
        error: vi.fn(),
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('createOrganization', () => {
    it('should create an organization', async () => {
      mockRequest.body = { name: 'New Organization' };
      vi.mocked(mockOrganizationService.createOrganization).mockResolvedValue(mockOrg as any);

      await controller.createOrganization(mockRequest as any, mockReply as any);

      expect(mockOrganizationService.createOrganization).toHaveBeenCalledWith(
        'New Organization',
        'user-1-uuid',
      );
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(mockOrg);
    });

    it('should throw ValidationError for invalid name', async () => {
      mockRequest.body = { name: 'ab' }; // Too short (min 3)

      await expect(
        controller.createOrganization(mockRequest as any, mockReply as any),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('listOrganizations', () => {
    it('should return user organizations', async () => {
      vi.mocked(mockOrganizationService.getUserOrganizations).mockResolvedValue([mockOrg] as any);

      const result = await controller.listOrganizations(mockRequest as any, mockReply as any);

      expect(mockOrganizationService.getUserOrganizations).toHaveBeenCalledWith('user-1-uuid');
      expect(result).toEqual([mockOrg]);
    });
  });

  describe('getOrganization', () => {
    it('should return organization by id', async () => {
      mockRequest.params = { id: '00000000-0000-4000-8000-000000000001' };
      vi.mocked(mockOrganizationService.getOrganizationById).mockResolvedValue(mockOrg as any);

      const result = await controller.getOrganization(mockRequest as any, mockReply as any);

      expect(mockOrganizationService.getOrganizationById).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000001',
        'user-1-uuid',
      );
      expect(result).toEqual(mockOrg);
    });

    it('should throw ValidationError for invalid uuid', async () => {
      mockRequest.params = { id: 'invalid-uuid' };

      await expect(
        controller.getOrganization(mockRequest as any, mockReply as any),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('addMember', () => {
    it('should add a member', async () => {
      mockRequest.params = { id: '00000000-0000-4000-8000-000000000001' };
      mockRequest.body = {
        userId: '00000000-0000-4000-8000-000000000002',
        role: 'ADMIN',
      };
      vi.mocked(mockOrganizationService.addMember).mockResolvedValue(mockMember as any);

      await controller.addMember(mockRequest as any, mockReply as any);

      expect(mockOrganizationService.addMember).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        'ADMIN',
        'user-1-uuid',
      );
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(mockMember);
    });

    it('should throw ValidationError for invalid role', async () => {
      mockRequest.params = { id: '00000000-0000-4000-8000-000000000001' };
      mockRequest.body = {
        userId: '00000000-0000-4000-8000-000000000002',
        role: 'INVALID_ROLE',
      };

      await expect(controller.addMember(mockRequest as any, mockReply as any)).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('updateMember', () => {
    it('should update member role', async () => {
      mockRequest.params = {
        id: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000002',
      };
      mockRequest.body = { role: 'OWNER' };
      vi.mocked(mockOrganizationService.updateMemberRole).mockResolvedValue({
        ...mockMember,
        role: 'OWNER',
      } as any);

      const result = await controller.updateMember(mockRequest as any, mockReply as any);

      expect(mockOrganizationService.updateMemberRole).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        'OWNER',
        'user-1-uuid',
      );
      expect(result).toEqual({ ...mockMember, role: 'OWNER' });
    });
  });

  describe('removeMember', () => {
    it('should remove a member', async () => {
      mockRequest.params = {
        id: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000002',
      };
      vi.mocked(mockOrganizationService.removeMember).mockResolvedValue(undefined);

      await controller.removeMember(mockRequest as any, mockReply as any);

      expect(mockOrganizationService.removeMember).toHaveBeenCalledWith(
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        'user-1-uuid',
      );
      expect(mockReply.status).toHaveBeenCalledWith(204);
      expect(mockReply.send).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should propagate ForbiddenError from service', async () => {
      mockRequest.params = { id: '00000000-0000-4000-8000-000000000001' };
      vi.mocked(mockOrganizationService.getOrganizationById).mockRejectedValue(
        new ForbiddenError('Access denied'),
      );

      await expect(
        controller.getOrganization(mockRequest as any, mockReply as any),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should propagate NotFoundError from service', async () => {
      mockRequest.params = { id: '00000000-0000-4000-8000-000000000001' };
      vi.mocked(mockOrganizationService.getOrganizationById).mockRejectedValue(
        new NotFoundError('Not found'),
      );

      await expect(
        controller.getOrganization(mockRequest as any, mockReply as any),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
