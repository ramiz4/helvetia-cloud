/**
 * Status lock configuration constants
 */
export const STATUS_LOCK_TTL_MS = parseInt(process.env.STATUS_LOCK_TTL_MS || '10000', 10);

/**
 * Lock retry configuration
 */
export const LOCK_RETRY_DELAY_MS = parseInt(process.env.LOCK_RETRY_DELAY_MS || '200', 10);
export const LOCK_RETRY_JITTER_MS = parseInt(process.env.LOCK_RETRY_JITTER_MS || '100', 10);
