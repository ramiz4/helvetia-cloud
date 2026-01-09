import crypto from 'crypto';
import { prisma } from 'database';
import IORedis from 'ioredis';

// Token expiration times
export const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
export const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days

// Initialize Redis connection for token revocation
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new IORedis(redisUrl);

/**
 * Generate a secure random refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
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
 * Validate a refresh token and return the user ID if valid
 */
export async function validateRefreshToken(token: string): Promise<string | null> {
  // Check if token is revoked in Redis
  const isRevoked = await redis.get(`revoked:refresh:${token}`);
  if (isRevoked) {
    return null;
  }

  // Check if token exists and is not expired
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!refreshToken) {
    return null;
  }

  if (refreshToken.expiresAt < new Date()) {
    // Token expired, delete it
    await prisma.refreshToken.delete({ where: { token } });
    return null;
  }

  return refreshToken.userId;
}

/**
 * Revoke a refresh token (token rotation)
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  // Add to Redis revocation list with expiry
  const expirySeconds = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
  await redis.setex(`revoked:refresh:${token}`, expirySeconds, '1');

  // Delete from database
  await prisma.refreshToken
    .delete({ where: { token } })
    .catch(() => {
      // Token might already be deleted, ignore error
    });
}

/**
 * Revoke an access token (for logout)
 */
export async function revokeAccessToken(token: string, expiresIn: number): Promise<void> {
  // Add to Redis revocation list with expiry (time until token naturally expires)
  await redis.setex(`revoked:access:${token}`, expiresIn, '1');
}

/**
 * Check if an access token is revoked
 */
export async function isAccessTokenRevoked(token: string): Promise<boolean> {
  const isRevoked = await redis.get(`revoked:access:${token}`);
  return !!isRevoked;
}

/**
 * Revoke all refresh tokens for a user (useful for logout from all devices)
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  const tokens = await prisma.refreshToken.findMany({
    where: { userId },
  });

  // Add all tokens to Redis revocation list
  const expirySeconds = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
  await Promise.all(
    tokens.map((t) => redis.setex(`revoked:refresh:${t.token}`, expirySeconds, '1')),
  );

  // Delete all from database
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

/**
 * Clean up expired refresh tokens from database
 */
export async function cleanupExpiredTokens(): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}
