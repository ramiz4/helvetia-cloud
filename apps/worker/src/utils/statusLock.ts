import IORedis from 'ioredis';
import Redlock from 'redlock';

// Type for Lock from redlock
type Lock = {
  value: string;
  attempts: Array<{ resourceKey: string; value: string }>;
  expiration: number;
  release(): Promise<void>;
  extend(ttl: number): Promise<Lock>;
};

// Initialize Redis client for Redlock
const redisClient = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Initialize Redlock with retry settings
const redlock = new Redlock([redisClient as any], {
  // Retry settings for lock acquisition
  retryCount: 10,
  retryDelay: 200, // 200ms between retries
  retryJitter: 100, // Add up to 100ms random jitter
  // Drift factor for clock drift tolerance
  driftFactor: 0.01,
});

// Listen for errors to avoid unhandled rejections
redlock.on('clientError', (error) => {
  console.error('Redlock error:', error);
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
 * @param ttl - Time to live in milliseconds (default: 10000ms = 10s)
 * @returns Lock instance
 */
export async function acquireStatusLock(serviceId: string, ttl = 10000): Promise<Lock> {
  const lockKey = getStatusLockKey(serviceId);
  try {
    const lock = (await redlock.acquire([lockKey], ttl)) as unknown as Lock;
    console.log(`Acquired lock for service ${serviceId}`);
    return lock;
  } catch (error) {
    console.error(`Failed to acquire lock for service ${serviceId}:`, error);
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
    console.log('Lock released successfully');
  } catch (error) {
    console.error('Failed to release lock:', error);
    // Don't throw here - lock will expire anyway
  }
}

/**
 * Executes a function with a distributed lock for service status updates
 * @param serviceId - The service ID to lock
 * @param fn - The function to execute while holding the lock
 * @param ttl - Time to live in milliseconds (default: 10000ms = 10s)
 * @returns The result of the function
 */
export async function withStatusLock<T>(
  serviceId: string,
  fn: () => Promise<T>,
  ttl = 10000,
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
    console.log(`Extended lock for ${ttl}ms`);
    return extendedLock;
  } catch (error) {
    console.error('Failed to extend lock:', error);
    throw error;
  }
}

// Export redlock instance for advanced use cases
export { redlock };
