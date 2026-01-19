import { Redis } from 'ioredis';
import Redlock from 'redlock';
import { LOCK_RETRY_DELAY_MS, LOCK_RETRY_JITTER_MS, STATUS_LOCK_TTL_MS } from './constants.js';
import { logger } from './logger.js';

// Type for Lock from redlock
// Note: Custom type definition needed due to incompatibilities between
// redlock@5.0.0-beta.2 and @types/redlock package
type Lock = {
  value: string;
  attempts: Array<{ resourceKey: string; value: string }>;
  expiration: number;
  release(): Promise<void>;
  extend(ttl: number): Promise<Lock>;
};

// Initialize Redis client for Redlock
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - redlock@5.0.0-beta.2 typings may be incompatible with ioredis 5.x client types in some environments
const redlock = new Redlock([redisClient], {
  // Retry settings for lock acquisition
  retryCount: 10,
  retryDelay: LOCK_RETRY_DELAY_MS,
  retryJitter: LOCK_RETRY_JITTER_MS,
  // Drift factor for clock drift tolerance
  driftFactor: 0.01,
});

// Listen for errors to avoid unhandled rejections
redlock.on('clientError', (error) => {
  logger.error({ err: error }, 'Redlock error');
});

/**
 * Lock key generator for service status updates
 */
export function getStatusLockKey(serviceId: string): string {
  return `status:lock:${serviceId}`;
}

/**
 * Acquires a distributed lock for service status updates
 * @param serviceId - The service ID to lock
 * @param ttl - Time to live in milliseconds (default from config)
 * @returns Lock instance
 */
export async function acquireStatusLock(
  serviceId: string,
  ttl = STATUS_LOCK_TTL_MS,
): Promise<Lock> {
  const lockKey = getStatusLockKey(serviceId);
  try {
    // Note: Type assertion needed due to redlock beta version type incompatibilities
    const lock = (await redlock.acquire([lockKey], ttl)) as unknown as Lock;
    logger.debug(`Acquired lock for service ${serviceId}`);
    return lock;
  } catch (error) {
    logger.error({ err: error, serviceId }, 'Failed to acquire lock');
    throw new Error(`Could not acquire status lock for service ${serviceId}`);
  }
}

/**
 * Releases a distributed lock
 * @param lock - The lock to release
 */
export async function releaseStatusLock(lock: Lock): Promise<void> {
  try {
    await lock.release();
    logger.debug('Lock released successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to release lock');
    // Don't throw here - lock will expire anyway
  }
}

/**
 * Executes a function with a distributed lock for service status updates
 * @param serviceId - The service ID to lock
 * @param fn - The function to execute while holding the lock
 * @param ttl - Time to live in milliseconds (default from config)
 * @returns The result of the function
 */
export async function withStatusLock<T>(
  serviceId: string,
  fn: () => Promise<T>,
  ttl = STATUS_LOCK_TTL_MS,
): Promise<T> {
  let lock: Lock | null = null;
  try {
    lock = await acquireStatusLock(serviceId, ttl);
    const result = await fn();
    return result;
  } finally {
    if (lock) {
      await releaseStatusLock(lock);
    }
  }
}

/**
 * Extends the TTL of an existing lock
 * @param lock - The lock to extend
 * @param ttl - Additional time in milliseconds
 */
export async function extendStatusLock(lock: Lock, ttl: number): Promise<Lock> {
  try {
    const extendedLock = (await lock.extend(ttl)) as unknown as Lock;
    logger.debug(`Extended lock for ${ttl}ms`);
    return extendedLock;
  } catch (error) {
    logger.error({ err: error }, 'Failed to extend lock');
    throw error;
  }
}

// Export redlock instance for advanced use cases
export { redlock };
