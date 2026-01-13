import crypto from 'crypto';
import { prisma, User } from 'database';
import type { FastifyInstance } from 'fastify';
import type IORedis from 'ioredis';

const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const ACCESS_TOKEN_EXPIRY_MINUTES = 15;

/**
 * Generate a cryptographically secure refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create and store a refresh token in the database
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

/**
 * Verify and rotate a refresh token
 * Returns new access and refresh tokens if valid, null if invalid
 */
export async function verifyAndRotateRefreshToken(
  token: string,
  fastify: FastifyInstance,
  redis: IORedis,
): Promise<{ accessToken: string; refreshToken: string; userId: string; user: User } | null> {
  // Check if token is in revocation list (Redis)
  const isRevoked = await redis.get(`revoked:refresh:${token}`);
  if (isRevoked) {
    console.log('Refresh token is revoked');
    return null;
  }

  // Find the refresh token in database
  const refreshTokenRecord = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!refreshTokenRecord) {
    console.log('Refresh token not found');
    return null;
  }

  // Check if token is revoked in database
  if (refreshTokenRecord.revoked) {
    console.log('Refresh token is revoked in database');
    return null;
  }

  // Check if token is expired
  if (new Date() > refreshTokenRecord.expiresAt) {
    console.log('Refresh token is expired');
    // Mark as revoked
    await revokeRefreshToken(token, redis);
    return null;
  }

  const user = refreshTokenRecord.user;

  // Generate new access token
  const accessToken = fastify.jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    { expiresIn: `${ACCESS_TOKEN_EXPIRY_MINUTES}m` },
  );

  // Revoke old refresh token
  await revokeRefreshToken(token, redis);

  // Generate new refresh token (rotation)
  const newRefreshToken = await createRefreshToken(user.id);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    userId: user.id,
    user,
  };
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(token: string, redis: IORedis): Promise<void> {
  // Mark as revoked in database
  await prisma.refreshToken.updateMany({
    where: { token },
    data: {
      revoked: true,
      revokedAt: new Date(),
    },
  });

  // Add to Redis revocation list (TTL = 30 days)
  await redis.setex(`revoked:refresh:${token}`, REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60, '1');
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(userId: string, redis: IORedis): Promise<void> {
  const tokens = await prisma.refreshToken.findMany({
    where: { userId, revoked: false },
  });

  for (const tokenRecord of tokens) {
    await revokeRefreshToken(tokenRecord.token, redis);
  }
}

/**
 * Clean up expired refresh tokens (can be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}

/**
 * Get access token expiry in minutes
 */
export function getAccessTokenExpiryMinutes(): number {
  return ACCESS_TOKEN_EXPIRY_MINUTES;
}
