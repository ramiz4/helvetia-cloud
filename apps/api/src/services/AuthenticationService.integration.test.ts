import axios from 'axios';
import { prisma, Role } from 'database';
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaOrganizationRepository } from '../repositories/PrismaOrganizationRepository';
import { PrismaUserRepository } from '../repositories/PrismaUserRepository';
import { AuthenticationService } from './AuthenticationService';
import { OrganizationService } from './OrganizationService';

// Skip these integration tests if DATABASE_URL is not set
const shouldSkip = !process.env.DATABASE_URL;
const describeIf = shouldSkip ? describe.skip : describe;

vi.mock('axios');
vi.mock('../utils/crypto', () => ({
  encrypt: vi.fn((token: string) => `encrypted_${token}`),
  decrypt: vi.fn((token: string) => token.replace('encrypted_', '')),
}));
vi.mock('../utils/refreshToken', () => ({
  createRefreshToken: vi.fn(async (userId: string) => `refresh_token_${userId}`),
}));

describeIf('AuthenticationService - Concurrent Organization Creation', () => {
  let authService: AuthenticationService;
  let userRepo: PrismaUserRepository;
  let orgRepo: PrismaOrganizationRepository;
  let orgService: OrganizationService;

  const testGithubId = 'test-concurrent-user-12345';
  const mockJwtSign = vi.fn((payload: any) => `jwt_${payload.id}`);

  beforeAll(async () => {
    // Setup repositories and services with real Prisma client
    userRepo = new PrismaUserRepository(prisma);
    orgRepo = new PrismaOrganizationRepository(prisma);
    orgService = new OrganizationService(orgRepo);
    authService = new AuthenticationService(userRepo, orgService, prisma);

    // Clean up any existing test data
    await prisma.organizationMember.deleteMany({
      where: { user: { githubId: testGithubId } },
    });
    await prisma.organization.deleteMany({
      where: { members: { none: {} } },
    });
    await prisma.user.deleteMany({
      where: { githubId: testGithubId },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.organizationMember.deleteMany({
      where: { user: { githubId: testGithubId } },
    });
    await prisma.organization.deleteMany({
      where: { members: { none: {} } },
    });
    await prisma.user.deleteMany({
      where: { githubId: testGithubId },
    });
  });

  it('should handle concurrent authentication requests without creating duplicate organizations', async () => {
    // Mock GitHub OAuth responses with different tokens for each request
    vi.mocked(axios.post)
      .mockResolvedValueOnce({
        data: { access_token: 'test_github_token_1', error: null },
      })
      .mockResolvedValueOnce({
        data: { access_token: 'test_github_token_2', error: null },
      })
      .mockResolvedValueOnce({
        data: { access_token: 'test_github_token_3', error: null },
      });

    vi.mocked(axios.get).mockResolvedValue({
      data: {
        id: parseInt(testGithubId, 10),
        login: 'concurrent-test-user',
        avatar_url: 'https://avatar.url',
      },
    });

    // Simulate concurrent authentication requests (3 simultaneous requests)
    const authPromises = [
      authService.authenticateWithGitHub('code1', mockJwtSign),
      authService.authenticateWithGitHub('code2', mockJwtSign),
      authService.authenticateWithGitHub('code3', mockJwtSign),
    ];

    // Wait for all requests to complete
    const results = await Promise.all(authPromises);

    // All requests should succeed
    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result.user.username).toBe('concurrent-test-user');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    // Verify that only ONE user was created
    const users = await prisma.user.findMany({
      where: { githubId: testGithubId },
    });
    expect(users).toHaveLength(1);

    // Verify that only ONE organization was created for this user
    const organizations = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId: users[0].id,
            role: Role.OWNER,
          },
        },
      },
    });
    expect(organizations).toHaveLength(1);
    expect(organizations[0].name).toContain('Personal');

    // Verify the organization has exactly one owner member
    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: organizations[0].id,
      },
    });
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(users[0].id);
    expect(members[0].role).toBe(Role.OWNER);
  });

  it('should not create organization if user already has one from a previous login', async () => {
    const testGithubId2 = 'test-existing-org-user-67890';

    // Clean up first
    await prisma.organizationMember.deleteMany({
      where: { user: { githubId: testGithubId2 } },
    });
    await prisma.organization.deleteMany({
      where: { members: { none: {} } },
    });
    await prisma.user.deleteMany({
      where: { githubId: testGithubId2 },
    });

    // Mock GitHub OAuth responses
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'test_github_token_2', error: null },
    });
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        id: parseInt(testGithubId2, 10),
        login: 'existing-org-user',
        avatar_url: 'https://avatar.url',
      },
    });

    // First authentication - should create organization
    const firstAuth = await authService.authenticateWithGitHub('code1', mockJwtSign);
    expect(firstAuth.user.username).toBe('existing-org-user');

    // Get organization count after first auth
    const orgsAfterFirst = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            user: { githubId: testGithubId2 },
          },
        },
      },
    });
    expect(orgsAfterFirst).toHaveLength(1);

    // Second authentication - should NOT create another organization
    const secondAuth = await authService.authenticateWithGitHub('code2', mockJwtSign);
    expect(secondAuth.user.username).toBe('existing-org-user');

    // Verify still only one organization
    const orgsAfterSecond = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            user: { githubId: testGithubId2 },
          },
        },
      },
    });
    expect(orgsAfterSecond).toHaveLength(1);
    expect(orgsAfterSecond[0].id).toBe(orgsAfterFirst[0].id);

    // Clean up
    await prisma.organizationMember.deleteMany({
      where: { user: { githubId: testGithubId2 } },
    });
    await prisma.organization.deleteMany({
      where: { id: orgsAfterSecond[0].id },
    });
    await prisma.user.deleteMany({
      where: { githubId: testGithubId2 },
    });
  });
});
