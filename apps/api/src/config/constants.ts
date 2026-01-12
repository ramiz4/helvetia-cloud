/**
 * Configuration constants for API service
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

// Time Intervals (milliseconds)
export const METRICS_UPDATE_INTERVAL_MS = parseInt(
  process.env.METRICS_UPDATE_INTERVAL_MS || '5000',
  10,
);

export const STATUS_RECONCILIATION_INTERVAL_MS = parseInt(
  process.env.STATUS_RECONCILIATION_INTERVAL_MS || '30000',
  10,
);

export const STATUS_LOCK_TTL_MS = parseInt(process.env.STATUS_LOCK_TTL_MS || '10000', 10);

export const STATUS_RECONCILIATION_LOCK_TTL_MS = parseInt(
  process.env.STATUS_RECONCILIATION_LOCK_TTL_MS || '5000',
  10,
);

export const CONNECTION_TIMEOUT_MS = parseInt(
  process.env.CONNECTION_TIMEOUT_MS || String(30 * 60 * 1000), // 30 minutes default
  10,
);

// Lock Configuration
export const LOCK_RETRY_DELAY_MS = parseInt(process.env.LOCK_RETRY_DELAY_MS || '200', 10);
export const LOCK_RETRY_JITTER_MS = parseInt(process.env.LOCK_RETRY_JITTER_MS || '100', 10);

// Body Size Limits (bytes)
export const BODY_LIMIT_GLOBAL =
  parseInt(process.env.BODY_LIMIT_GLOBAL_MB || '10', 10) * 1024 * 1024;

export const BODY_LIMIT_STANDARD =
  parseInt(process.env.BODY_LIMIT_STANDARD_MB || '1', 10) * 1024 * 1024;

export const BODY_LIMIT_SMALL = parseInt(process.env.BODY_LIMIT_SMALL_KB || '100', 10) * 1024;

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
