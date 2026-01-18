import { PrismaClient } from 'database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const prisma = new PrismaClient();

// Skip these integration tests unless RUN_INTEGRATION_TESTS is set
// These tests require a real database to run
// Set RUN_INTEGRATION_TESTS=1 to enable these tests
const shouldSkip = process.env.RUN_INTEGRATION_TESTS !== '1';

describe.skipIf(shouldSkip)('Email/Password Authentication', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-email-auth' } },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-email-auth' } },
    });
    await prisma.$disconnect();
  });

  describe('User Registration', () => {
    it('should create user with email and password', async () => {
      const email = 'test-email-auth-1@example.com';
      const username = 'testuser1';

      const user = await prisma.user.create({
        data: {
          email,
          username,
          password: 'hashed_password',
          role: 'MEMBER',
        },
      });

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.username).toBe(username);
      expect(user.githubId).toBeNull();
      expect(user.password).toBe('hashed_password');
    });

    it('should not allow duplicate email', async () => {
      const email = 'test-email-auth-2@example.com';

      await prisma.user.create({
        data: {
          email,
          username: 'testuser2',
          password: 'hashed_password',
          role: 'MEMBER',
        },
      });

      await expect(
        prisma.user.create({
          data: {
            email,
            username: 'testuser3',
            password: 'hashed_password',
            role: 'MEMBER',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('GitHub Linking', () => {
    it('should allow linking GitHub to email user', async () => {
      const email = 'test-email-auth-3@example.com';
      const username = 'testuser4';

      const user = await prisma.user.create({
        data: {
          email,
          username,
          password: 'hashed_password',
          role: 'MEMBER',
        },
      });

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          githubId: '123456',
          githubAccessToken: 'encrypted_token',
        },
      });

      expect(updatedUser.githubId).toBe('123456');
      expect(updatedUser.email).toBe(email);
      expect(updatedUser.password).toBe('hashed_password');
    });

    it('should allow email user without GitHub', async () => {
      const email = 'test-email-auth-5@example.com';

      const user = await prisma.user.create({
        data: {
          email,
          username: 'testuser5',
          password: 'hashed_password',
          role: 'MEMBER',
        },
      });

      expect(user.githubId).toBeNull();
      expect(user.githubAccessToken).toBeNull();
    });

    it('should allow GitHub user without email initially', async () => {
      const user = await prisma.user.create({
        data: {
          githubId: '789012',
          username: 'githubuser1',
          githubAccessToken: 'encrypted_token',
          role: 'MEMBER',
        },
      });

      expect(user.email).toBeNull();
      expect(user.password).toBeNull();
    });
  });

  describe('Schema Validation', () => {
    it('should require username', async () => {
      await expect(
        prisma.user.create({
          data: {
            email: 'test-email-auth-6@example.com',
            password: 'hashed_password',
            role: 'MEMBER',
          } as any,
        }),
      ).rejects.toThrow();
    });

    it('should allow null githubId', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-email-auth-7@example.com',
          username: 'testuser7',
          password: 'hashed_password',
          githubId: null,
          role: 'MEMBER',
        },
      });

      expect(user.githubId).toBeNull();
    });
  });
});
