import { Role } from 'database';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IOrganizationRepository } from '../interfaces/IOrganizationRepository.js';
import { OrganizationService } from './OrganizationService.js';

describe('OrganizationService', () => {
  let organizationService: OrganizationService;
  let mockOrgRepo: IOrganizationRepository;

  beforeEach(() => {
    mockOrgRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByUserId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addMember: vi.fn(),
      updateMemberRole: vi.fn(),
      removeMember: vi.fn(),
      getMember: vi.fn(),
    } as any;

    organizationService = new OrganizationService(mockOrgRepo);
  });

  describe('createOrganization', () => {
    it('should create an organization with a slug', async () => {
      const orgData = { id: 'org-1', name: 'Test Org', slug: 'test-org' };
      vi.mocked(mockOrgRepo.findBySlug).mockResolvedValue(null);
      vi.mocked(mockOrgRepo.create).mockResolvedValue(orgData as any);

      const result = await organizationService.createOrganization('Test Org', 'user-1');

      expect(mockOrgRepo.create).toHaveBeenCalledWith({
        name: 'Test Org',
        slug: 'test-org',
        userId: 'user-1',
      });
      expect(result).toEqual(orgData);
    });
  });

  describe('RBAC', () => {
    it('should throw ForbiddenError if user is not a member', async () => {
      vi.mocked(mockOrgRepo.getMember).mockResolvedValue(null);

      await expect(
        organizationService.addMember('org-1', 'user-2', Role.MEMBER, 'user-3'),
      ).rejects.toThrow('You do not have permission to perform this action');
    });

    it('should throw ForbiddenError if user is only a MEMBER', async () => {
      vi.mocked(mockOrgRepo.getMember).mockResolvedValue({ role: Role.MEMBER } as any);

      await expect(
        organizationService.addMember('org-1', 'user-2', Role.MEMBER, 'user-3'),
      ).rejects.toThrow('You do not have permission to perform this action');
    });

    it('should allow OWNER to add members', async () => {
      vi.mocked(mockOrgRepo.getMember).mockResolvedValue({ role: Role.OWNER } as any);
      vi.mocked(mockOrgRepo.addMember).mockResolvedValue({ id: 'mem-1' } as any);

      const result = await organizationService.addMember('org-1', 'user-2', Role.MEMBER, 'user-3');

      expect(mockOrgRepo.addMember).toHaveBeenCalledWith('org-1', 'user-2', Role.MEMBER);
      expect(result).toEqual({ id: 'mem-1' });
    });
  });
});
