/**
 * Configuration constants for Worker service
 * These can be overridden via environment variables
 */

// Container Resource Limits
export const CONTAINER_MEMORY_LIMIT_MB = parseInt(
  process.env.CONTAINER_MEMORY_LIMIT_MB || '512',
  10,
);
export const CONTAINER_MEMORY_LIMIT_BYTES = CONTAINER_MEMORY_LIMIT_MB * 1024 * 1024;

export const CONTAINER_CPU_CORES = parseFloat(process.env.CONTAINER_CPU_CORES || '1.0');
export const CONTAINER_CPU_NANOCPUS = Math.floor(CONTAINER_CPU_CORES * 1000000000);

// Log Size Limits (characters)
export const MAX_LOG_SIZE_CHARS = parseInt(process.env.MAX_LOG_SIZE_CHARS || '50000', 10);

// Lock Configuration
export const STATUS_LOCK_TTL_MS = parseInt(process.env.STATUS_LOCK_TTL_MS || '10000', 10);
export const LOCK_RETRY_DELAY_MS = parseInt(process.env.LOCK_RETRY_DELAY_MS || '200', 10);
export const LOCK_RETRY_JITTER_MS = parseInt(process.env.LOCK_RETRY_JITTER_MS || '100', 10);

// Health Check Server
export const WORKER_HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '3002', 10);

// Docker Image Cleanup Configuration
export const IMAGE_RETENTION_DAYS = parseInt(process.env.IMAGE_RETENTION_DAYS || '7', 10);
export const DISK_USAGE_THRESHOLD_PERCENT = parseInt(
  process.env.DISK_USAGE_THRESHOLD_PERCENT || '80',
  10,
);
export const CLEANUP_DANGLING_IMAGES = process.env.CLEANUP_DANGLING_IMAGES !== 'false';
export const CLEANUP_OLD_IMAGES = process.env.CLEANUP_OLD_IMAGES !== 'false';
