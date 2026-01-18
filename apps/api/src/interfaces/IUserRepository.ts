import { Role } from 'database';

/**
 * User model type (matches Prisma schema)
 */
export interface User {
  id: string;
  githubId: string | null;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  githubAccessToken: string | null;
  role: Role;
  password?: string | null;
}

/**
 * User create input
 */
export interface UserCreateInput {
  id?: string;
  githubId?: string | null;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  githubAccessToken?: string | null;
  role?: Role;
  password?: string | null;
}

/**
 * User update input
 */
export interface UserUpdateInput {
  githubId?: string | null;
  username?: string;
  email?: string | null;
  avatarUrl?: string | null;
  githubAccessToken?: string | null;
  role?: Role;
  password?: string | null;
}

/**
 * User where unique input
 */
export interface UserWhereUniqueInput {
  id?: string;
  githubId?: string;
  email?: string;
}

/**
 * Interface for user repository operations
 */
export interface IUserRepository {
  /**
   * Find a user by ID
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find a user by GitHub ID
   */
  findByGithubId(githubId: string): Promise<User | null>;

  /**
   * Find a user by username
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Find a user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Create a new user
   */
  create(data: UserCreateInput): Promise<User>;

  /**
   * Update a user
   */
  update(id: string, data: UserUpdateInput): Promise<User>;

  /**
   * Upsert a user (create or update)
   */
  upsert(
    where: UserWhereUniqueInput,
    create: UserCreateInput,
    update: UserUpdateInput,
  ): Promise<User>;

  /**
   * Delete a user
   */
  delete(id: string): Promise<void>;
}
