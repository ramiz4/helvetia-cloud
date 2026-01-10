import { z } from 'zod';

/**
 * Environment variable schema for API service
 * Validates all required and optional environment variables on startup
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server Configuration
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3001'),

  // Database Configuration
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),

  // Redis Configuration
  REDIS_URL: z.string().url().min(1, 'REDIS_URL is required'),

  // GitHub OAuth Configuration
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // JWT Authentication
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  ENCRYPTION_KEY: z
    .string()
    .length(32, 'ENCRYPTION_KEY must be exactly 32 characters')
    .min(1, 'ENCRYPTION_KEY is required'),
  ENCRYPTION_SALT: z.string().optional(),

  // Platform Configuration
  PLATFORM_DOMAIN: z.string().default('helvetia.cloud'),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),

  // CORS Configuration
  ALLOWED_ORIGINS: z.string().optional(),

  // Rate Limiting Configuration
  RATE_LIMIT_MAX: z.string().regex(/^\d+$/).transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  AUTH_RATE_LIMIT_MAX: z.string().regex(/^\d+$/).transform(Number).default('10'),
  AUTH_RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  WS_RATE_LIMIT_MAX: z.string().regex(/^\d+$/).transform(Number).default('10'),
  WS_RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // Container Resource Limits
  CONTAINER_MEMORY_LIMIT_MB: z.string().regex(/^\d+$/).transform(Number).default('512'),
  CONTAINER_CPU_CORES: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .default('1.0'),

  // Service Configuration
  METRICS_UPDATE_INTERVAL_MS: z.string().regex(/^\d+$/).transform(Number).default('5000'),
  STATUS_RECONCILIATION_INTERVAL_MS: z.string().regex(/^\d+$/).transform(Number).default('30000'),
  CONNECTION_TIMEOUT_MS: z.string().regex(/^\d+$/).transform(Number).default('1800000'),

  // Distributed Lock Configuration
  STATUS_LOCK_TTL_MS: z.string().regex(/^\d+$/).transform(Number).default('10000'),
  STATUS_RECONCILIATION_LOCK_TTL_MS: z.string().regex(/^\d+$/).transform(Number).default('5000'),
  LOCK_RETRY_DELAY_MS: z.string().regex(/^\d+$/).transform(Number).default('200'),
  LOCK_RETRY_JITTER_MS: z.string().regex(/^\d+$/).transform(Number).default('100'),

  // Body Size Limits
  BODY_LIMIT_GLOBAL_MB: z.string().regex(/^\d+$/).transform(Number).default('10'),
  BODY_LIMIT_STANDARD_MB: z.string().regex(/^\d+$/).transform(Number).default('1'),
  BODY_LIMIT_SMALL_KB: z.string().regex(/^\d+$/).transform(Number).default('100'),

  // Logging Configuration
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_REQUESTS: z
    .string()
    .transform((val) => val !== 'false')
    .default('true'),
  LOG_RESPONSES: z
    .string()
    .transform((val) => val !== 'false')
    .default('true'),

  // Test Environment
  VITEST: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed configuration
 * @throws {Error} with detailed validation errors if validation fails
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      });

      const errorMessage = [
        '❌ Invalid environment variables:',
        ...errors,
        '',
        'Please check your .env file and ensure all required variables are set.',
        'Refer to .env.example for the expected format.',
      ].join('\n');

      throw new Error(errorMessage);
    }
    throw error;
  }
}

/**
 * Validated environment configuration
 * This will be populated after validation runs
 */
export let env: Env;

/**
 * Initialize and validate environment configuration
 * Call this once at application startup
 */
export function initEnv(): void {
  env = validateEnv();
}
