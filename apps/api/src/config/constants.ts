import { parseIntEnv } from 'shared';

/**
 * Configuration constants for API service
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
 * Time Intervals (milliseconds)
 * Valid ranges documented for each constant
 */

// Metrics update interval: 1000 ms - 60000 ms (1 min)
export const METRICS_UPDATE_INTERVAL_MS = parseIntEnv('METRICS_UPDATE_INTERVAL_MS', 5000, {
  min: 1000,
  max: 60000,
});

// Status reconciliation interval: 5000 ms - 300000 ms (5 min)
export const STATUS_RECONCILIATION_INTERVAL_MS = parseIntEnv(
  'STATUS_RECONCILIATION_INTERVAL_MS',
  30000,
  { min: 5000, max: 300000 },
);

// Status lock TTL: 1000 ms - 60000 ms (1 min)
export const STATUS_LOCK_TTL_MS = parseIntEnv('STATUS_LOCK_TTL_MS', 10000, {
  min: 1000,
  max: 60000,
});

// Status reconciliation lock TTL: 1000 ms - 30000 ms
export const STATUS_RECONCILIATION_LOCK_TTL_MS = parseIntEnv(
  'STATUS_RECONCILIATION_LOCK_TTL_MS',
  5000,
  { min: 1000, max: 30000 },
);

// Connection timeout: 60000 ms (1 min) - 7200000 ms (2 hours)
export const CONNECTION_TIMEOUT_MS = parseIntEnv(
  'CONNECTION_TIMEOUT_MS',
  30 * 60 * 1000, // 30 minutes default
  { min: 60000, max: 7200000 },
);

/**
 * Lock Configuration
 * Valid ranges documented for each constant
 */

// Lock retry delay: 50 ms - 5000 ms
export const LOCK_RETRY_DELAY_MS = parseIntEnv('LOCK_RETRY_DELAY_MS', 200, { min: 50, max: 5000 });

// Lock retry jitter: 0 ms - 1000 ms
export const LOCK_RETRY_JITTER_MS = parseIntEnv('LOCK_RETRY_JITTER_MS', 100, { min: 0, max: 1000 });

/**
 * Body Size Limits (bytes)
 * Valid ranges documented for each constant
 */

// Global body limit: 1 MB - 100 MB
export const BODY_LIMIT_GLOBAL =
  parseIntEnv('BODY_LIMIT_GLOBAL_MB', 10, { min: 1, max: 100 }) * 1024 * 1024;

// Standard body limit: 1 MB - 10 MB
export const BODY_LIMIT_STANDARD =
  parseIntEnv('BODY_LIMIT_STANDARD_MB', 1, { min: 1, max: 10 }) * 1024 * 1024;

// Small body limit: 10 KB - 1024 KB (1 MB)
export const BODY_LIMIT_SMALL =
  parseIntEnv('BODY_LIMIT_SMALL_KB', 100, { min: 10, max: 1024 }) * 1024;

// Logging Configuration
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.token',
  'req.body.secret',
  'req.body.githubAccessToken',
];
export const LOG_REQUESTS = process.env.LOG_REQUESTS === 'true'; // Default to false
export const LOG_RESPONSES = process.env.LOG_RESPONSES === 'true'; // Default to false
