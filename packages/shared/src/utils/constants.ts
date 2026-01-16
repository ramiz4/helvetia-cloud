/**
 * Container resource limit constants
 * These can be overridden via environment variables
 */
export const CONTAINER_MEMORY_LIMIT_MB = parseInt(
  process.env.CONTAINER_MEMORY_LIMIT_MB || '512',
  10,
);
export const CONTAINER_MEMORY_LIMIT_BYTES = CONTAINER_MEMORY_LIMIT_MB * 1024 * 1024;

export const CONTAINER_CPU_CORES = parseFloat(process.env.CONTAINER_CPU_CORES || '1.0');
export const CONTAINER_CPU_NANOCPUS = Math.floor(CONTAINER_CPU_CORES * 1000000000);

/**
 * Status lock configuration constants
 */
export const STATUS_LOCK_TTL_MS = parseInt(process.env.STATUS_LOCK_TTL_MS || '10000', 10);

/**
 * Lock retry configuration
 */
export const LOCK_RETRY_DELAY_MS = parseInt(process.env.LOCK_RETRY_DELAY_MS || '200', 10);
export const LOCK_RETRY_JITTER_MS = parseInt(process.env.LOCK_RETRY_JITTER_MS || '100', 10);
