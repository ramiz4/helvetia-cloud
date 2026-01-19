import { PrismaClient } from '@prisma/client';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  User,
  UserCreateInput,
  UserUpdateInput,
  UserWhereUniqueInput,
} from '../interfaces/index.js';
import { PrismaUserRepository } from './PrismaUserRepository.js';

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;
  let mockPrisma: PrismaClient;

  const mockUser: User = {
    id: 'user-1',
    githubId: '12345',
    username: 'testuser',
    avatarUrl: 'https://example.com/avatar.jpg',
    githubAccessToken: 'encrypted-token',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as PrismaClient;

    repository = new PrismaUserRepository(mockPrisma);
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await repository.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should return null when user not found', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByGithubId', () => {
    it('should find user by github id', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await repository.findByGithubId('12345');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { githubId: '12345' },
      });
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createInput: UserCreateInput = {
        githubId: '12345',
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      vi.mocked(mockPrisma.user.create).mockResolvedValue(mockUser);

      const result = await repository.create(createInput);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: createInput,
      });
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateData: UserUpdateInput = {
        username: 'updateduser',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      };

      vi.mocked(mockPrisma.user.update).mockResolvedValue({
        ...mockUser,
        ...updateData,
      });

      const result = await repository.update('user-1', updateData);

      expect(result.username).toBe('updateduser');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateData,
      });
    });
  });

  describe('upsert', () => {
    it('should upsert a user', async () => {
      const where: UserWhereUniqueInput = { githubId: '12345' };
      const create: UserCreateInput = {
        githubId: '12345',
        username: 'testuser',
      };
      const update: UserUpdateInput = {
        username: 'updateduser',
      };

      vi.mocked(mockPrisma.user.upsert).mockResolvedValue(mockUser);

      const result = await repository.upsert(where, create, update);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where,
        create,
        update,
      });
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      vi.mocked(mockPrisma.user.delete).mockResolvedValue(mockUser);

      await repository.delete('user-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });
  });
});
