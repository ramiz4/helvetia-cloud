import { parseFloatEnv, parseIntEnv, parseStringEnv } from './configParser.js';

/**
 * Container resource limit constants
 * These can be overridden via environment variables
 *
 * Valid ranges:
 * - CONTAINER_MEMORY_LIMIT_MB: 64 MB - 8192 MB (8 GB)
 * - CONTAINER_CPU_CORES: 0.1 - 8.0 cores
 */
export const CONTAINER_MEMORY_LIMIT_MB = parseIntEnv(
  'CONTAINER_MEMORY_LIMIT_MB',
  512, // Default: 512 MB
  { min: 64, max: 8192 }, // Min: 64 MB, Max: 8 GB
);
export const CONTAINER_MEMORY_LIMIT_BYTES = CONTAINER_MEMORY_LIMIT_MB * 1024 * 1024;

export const CONTAINER_CPU_CORES = parseFloatEnv(
  'CONTAINER_CPU_CORES',
  1.0, // Default: 1.0 cores
  { min: 0.1, max: 8.0 }, // Min: 0.1 cores, Max: 8 cores
);
export const CONTAINER_CPU_NANOCPUS = Math.floor(CONTAINER_CPU_CORES * 1000000000);

/**
 * Status lock configuration constants
 * Valid ranges:
 * - STATUS_LOCK_TTL_MS: 1000 ms - 60000 ms (1 min)
 */
export const STATUS_LOCK_TTL_MS = parseIntEnv(
  'STATUS_LOCK_TTL_MS',
  10000, // Default: 10 seconds
  { min: 1000, max: 60000 }, // Min: 1 second, Max: 1 minute
);

/**
 * Lock retry configuration
 * Valid ranges:
 * - LOCK_RETRY_DELAY_MS: 50 ms - 5000 ms
 * - LOCK_RETRY_JITTER_MS: 0 ms - 1000 ms
 */
export const LOCK_RETRY_DELAY_MS = parseIntEnv(
  'LOCK_RETRY_DELAY_MS',
  200, // Default: 200 ms
  { min: 50, max: 5000 },
);
export const LOCK_RETRY_JITTER_MS = parseIntEnv(
  'LOCK_RETRY_JITTER_MS',
  100, // Default: 100 ms
  { min: 0, max: 1000 },
);

/**
 * Regular expression for validating domain names
 * Supports multi-level domains (e.g., api.helvetia.cloud, staging.helvetia.cloud)
 * Pattern: one or more labels (alphanumeric with hyphens) separated by dots, ending with TLD
 */
export const PLATFORM_DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Platform domain configuration
 * Used for generating service URLs and Traefik routing rules
 * Can be overridden via PLATFORM_DOMAIN environment variable
 */
export const PLATFORM_DOMAIN = parseStringEnv('PLATFORM_DOMAIN', 'helvetia.cloud', {
  validate: (value) => {
    // Basic domain validation: must contain at least one dot and valid label characters
    return PLATFORM_DOMAIN_REGEX.test(value);
  },
  errorMessage: 'must be a valid domain name',
});
