import { Prisma, PrismaClient } from 'database';
import { inject, injectable } from 'tsyringe';
import {
  IUserRepository,
  User,
  UserCreateInput,
  UserUpdateInput,
  UserWhereUniqueInput,
} from '../interfaces/index.js';

/**
 * Prisma implementation of IUserRepository
 */
@injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByGithubId(githubId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { githubId } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { username } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data: data as unknown as Prisma.UserCreateInput });
  }

  async update(id: string, data: UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: data as unknown as Prisma.UserUpdateInput,
    });
  }

  async upsert(
    where: UserWhereUniqueInput,
    create: UserCreateInput,
    update: UserUpdateInput,
  ): Promise<User> {
    return this.prisma.user.upsert({
      where: where as unknown as Prisma.UserWhereUniqueInput,
      create: create as unknown as Prisma.UserCreateInput,
      update: update as unknown as Prisma.UserUpdateInput,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
