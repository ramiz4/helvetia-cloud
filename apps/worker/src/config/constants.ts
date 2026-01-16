import { parseIntEnv } from 'shared';

/**
 * Configuration constants for Worker service
 * These can be overridden via environment variables
 */

// Container Resource Limits (re-exported from shared package)
export {
  CONTAINER_CPU_CORES,
  CONTAINER_CPU_NANOCPUS,
  CONTAINER_MEMORY_LIMIT_BYTES,
  CONTAINER_MEMORY_LIMIT_MB,
} from 'shared';

/**
 * Log Size Limits (characters)
 * Valid range: 1000 - 1000000 chars
 */
export const MAX_LOG_SIZE_CHARS = parseIntEnv('MAX_LOG_SIZE_CHARS', 50000, {
  min: 1000,
  max: 1000000,
});

/**
 * Lock Configuration
 * Valid ranges documented for each constant
 */

// Status lock TTL: 1000 ms - 60000 ms (1 min)
export const STATUS_LOCK_TTL_MS = parseIntEnv('STATUS_LOCK_TTL_MS', 10000, {
  min: 1000,
  max: 60000,
});

// Lock retry delay: 50 ms - 5000 ms
export const LOCK_RETRY_DELAY_MS = parseIntEnv('LOCK_RETRY_DELAY_MS', 200, { min: 50, max: 5000 });

// Lock retry jitter: 0 ms - 1000 ms
export const LOCK_RETRY_JITTER_MS = parseIntEnv('LOCK_RETRY_JITTER_MS', 100, { min: 0, max: 1000 });

/**
 * Health Check Server
 * Valid range: 1024 - 65535
 */
export const WORKER_HEALTH_PORT = parseIntEnv('WORKER_HEALTH_PORT', 3003, {
  min: 1024,
  max: 65535,
});

/**
 * Docker Image Cleanup Configuration
 * Valid ranges documented for each constant
 */

// Image retention: 1 - 90 days
export const IMAGE_RETENTION_DAYS = parseIntEnv('IMAGE_RETENTION_DAYS', 7, { min: 1, max: 90 });

// Disk usage threshold: 50% - 95%
export const DISK_USAGE_THRESHOLD_PERCENT = parseIntEnv('DISK_USAGE_THRESHOLD_PERCENT', 80, {
  min: 50,
  max: 95,
});
export const CLEANUP_DANGLING_IMAGES = process.env.CLEANUP_DANGLING_IMAGES !== 'false';
export const CLEANUP_OLD_IMAGES = process.env.CLEANUP_OLD_IMAGES !== 'false';
