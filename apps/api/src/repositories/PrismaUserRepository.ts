import { PrismaClient } from '@prisma/client';
import { injectable } from 'tsyringe';
import {
  IUserRepository,
  User,
  UserCreateInput,
  UserUpdateInput,
  UserWhereUniqueInput,
} from '../interfaces';

/**
 * Prisma implementation of IUserRepository
 */
@injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByGithubId(githubId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { githubId } });
  }

  async create(data: UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async upsert(
    where: UserWhereUniqueInput,
    create: UserCreateInput,
    update: UserUpdateInput,
  ): Promise<User> {
    return this.prisma.user.upsert({
      where,
      create,
      update,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
