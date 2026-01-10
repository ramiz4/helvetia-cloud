import IORedis from 'ioredis';

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;

/**
 * Rate limit configuration factory
 * Creates rate limit configs for different endpoint types
 */
export function createRateLimitConfigs(redisConnection: IORedis) {
  // Stricter rate limiting for authentication endpoints
  const authRateLimitConfig = {
    max: isTestEnv ? 10000 : parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
    timeWindow: process.env.AUTH_RATE_LIMIT_WINDOW || '1 minute',
    redis: redisConnection,
    nameSpace: 'helvetia-auth-rate-limit:',
    skipOnError: true,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  };

  // Stricter rate limiting for SSE/streaming endpoints
  const wsRateLimitConfig = {
    max: isTestEnv ? 10000 : parseInt(process.env.WS_RATE_LIMIT_MAX || '10', 10),
    timeWindow: process.env.WS_RATE_LIMIT_WINDOW || '1 minute',
    redis: redisConnection,
    nameSpace: 'helvetia-ws-rate-limit:',
    skipOnError: true,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  };

  return { authRateLimitConfig, wsRateLimitConfig };
}
