/**
 * RefreshToken model type (matches Prisma schema)
 */
export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  revoked: boolean;
  revokedAt: Date | null;
}

/**
 * RefreshToken create input
 */
export interface RefreshTokenCreateInput {
  id?: string;
  token: string;
  userId: string;
  expiresAt: Date;
  revoked?: boolean;
  revokedAt?: Date | null;
}

/**
 * RefreshToken where input
 */
export interface RefreshTokenWhereInput {
  id?: string;
  token?: string;
  userId?: string;
  revoked?: boolean;
}

/**
 * RefreshToken update many input
 */
export interface RefreshTokenUpdateManyMutationInput {
  revoked?: boolean;
  revokedAt?: Date | null;
}

/**
 * Interface for refresh token repository operations
 */
export interface IRefreshTokenRepository {
  /**
   * Find a refresh token by ID
   */
  findById(id: string): Promise<RefreshToken | null>;

  /**
   * Find refresh tokens by user ID
   */
  findByUserId(userId: string): Promise<RefreshToken[]>;

  /**
   * Create a new refresh token
   */
  create(data: RefreshTokenCreateInput): Promise<RefreshToken>;

  /**
   * Update refresh tokens (for rotation)
   */
  updateMany(
    where: RefreshTokenWhereInput,
    data: RefreshTokenUpdateManyMutationInput,
  ): Promise<number>;

  /**
   * Delete refresh tokens
   */
  deleteMany(where: RefreshTokenWhereInput): Promise<number>;
}
