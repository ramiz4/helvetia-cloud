/**
 * Utility functions for shared functionality
 */

// Status lock utilities
export {
  acquireStatusLock,
  extendStatusLock,
  getStatusLockKey,
  redlock,
  releaseStatusLock,
  withStatusLock,
} from './statusLock';

// Log utilities
export { logger, loggerOptions, type Logger } from './logger';
export { createScrubber } from './logs';

// Config parser utilities
export { parseFloatEnv, parseIntEnv, parseStringEnv } from './configParser';

// Constants
export {
  CONTAINER_CPU_CORES,
  CONTAINER_CPU_NANOCPUS,
  CONTAINER_MEMORY_LIMIT_BYTES,
  CONTAINER_MEMORY_LIMIT_MB,
  LOCK_RETRY_DELAY_MS,
  LOCK_RETRY_JITTER_MS,
  PLATFORM_DOMAIN,
  PLATFORM_DOMAIN_REGEX,
  STATUS_LOCK_TTL_MS,
} from './constants';
