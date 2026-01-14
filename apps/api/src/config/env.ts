import { z } from 'zod';

/**
 * Environment variable schema for API service
 * Validates all required and optional environment variables on startup
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server Configuration
  PORT: z
    .string()
    .default('3001')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),

  // Database Configuration
  DATABASE_URL: z.url().min(1, 'DATABASE_URL is required'),

  // Redis Configuration
  REDIS_URL: z.url().min(1, 'REDIS_URL is required'),

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
  APP_BASE_URL: z.url().default('http://localhost:3000'),
  HELVETIA_ADMIN: z.string().optional(),
  HELVETIA_ADMIN_PASSWORD: z.string().optional(),

  // CORS Configuration
  ALLOWED_ORIGINS: z.string().optional(),

  // Rate Limiting Configuration
  RATE_LIMIT_MAX: z
    .string()
    .default('100')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  AUTH_RATE_LIMIT_MAX: z
    .string()
    .default('10')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  AUTH_RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  WS_RATE_LIMIT_MAX: z
    .string()
    .default('100')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  WS_RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // Container Resource Limits
  CONTAINER_MEMORY_LIMIT_MB: z
    .string()
    .default('512')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  CONTAINER_CPU_CORES: z
    .string()
    .default('1.0')
    .pipe(
      z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .transform((val) => parseFloat(val)),
    ),

  // Service Configuration
  METRICS_UPDATE_INTERVAL_MS: z
    .string()
    .default('5000')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  STATUS_RECONCILIATION_INTERVAL_MS: z
    .string()
    .default('30000')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  CONNECTION_TIMEOUT_MS: z
    .string()
    .default('1800000')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),

  // Distributed Lock Configuration
  STATUS_LOCK_TTL_MS: z
    .string()
    .default('10000')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  STATUS_RECONCILIATION_LOCK_TTL_MS: z
    .string()
    .default('5000')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  LOCK_RETRY_DELAY_MS: z
    .string()
    .default('200')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  LOCK_RETRY_JITTER_MS: z
    .string()
    .default('100')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),

  // Body Size Limits
  BODY_LIMIT_GLOBAL_MB: z
    .string()
    .default('10')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  BODY_LIMIT_STANDARD_MB: z
    .string()
    .default('1')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  BODY_LIMIT_SMALL_KB: z
    .string()
    .default('100')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),

  // Logging Configuration
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_REQUESTS: z
    .string()
    .default('true')
    .pipe(z.string().transform((val) => val !== 'false')),
  LOG_RESPONSES: z
    .string()
    .default('true')
    .pipe(z.string().transform((val) => val !== 'false')),

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
      const errors = (error.issues || []).map((err) => {
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
