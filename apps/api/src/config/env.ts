import { baseEnvSchema, intFromString, validateEnvironment } from 'shared';
import { z } from 'zod';

/**
 * Environment variable schema for API service
 * Extends base schema with API-specific environment variables
 */
const envSchema = baseEnvSchema.extend({
  // Server Configuration
  PORT: intFromString('3001'),

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
  APP_BASE_URL: z.url().default('http://localhost:3000'),
  HELVETIA_ADMIN: z.string().optional(),
  HELVETIA_ADMIN_PASSWORD: z.string().optional(),

  // CORS Configuration
  ALLOWED_ORIGINS: z.string().optional(),

  // Rate Limiting Configuration
  RATE_LIMIT_MAX: intFromString('100'),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  AUTH_RATE_LIMIT_MAX: intFromString('10'),
  AUTH_RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  WS_RATE_LIMIT_MAX: intFromString('100'),
  WS_RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // Service Configuration
  METRICS_UPDATE_INTERVAL_MS: intFromString('5000'),
  STATUS_RECONCILIATION_INTERVAL_MS: intFromString('30000'),
  CONNECTION_TIMEOUT_MS: intFromString('1800000'),

  // Distributed Lock Configuration (API-specific locks)
  STATUS_RECONCILIATION_LOCK_TTL_MS: intFromString('5000'),

  // Body Size Limits
  BODY_LIMIT_GLOBAL_MB: intFromString('10'),
  BODY_LIMIT_STANDARD_MB: intFromString('1'),
  BODY_LIMIT_SMALL_KB: intFromString('100'),

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

  // Stripe Billing Configuration
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_STARTER: z.string().optional(),
  STRIPE_PRICE_ID_PRO: z.string().optional(),
  STRIPE_PRICE_ID_ENTERPRISE: z.string().optional(),
  STRIPE_PRICE_ID_COMPUTE_HOURS: z.string().optional(),
  STRIPE_PRICE_ID_MEMORY_GB_HOURS: z.string().optional(),
  STRIPE_PRICE_ID_BANDWIDTH_GB: z.string().optional(),
  STRIPE_PRICE_ID_STORAGE_GB: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed configuration
 * @throws {Error} with detailed validation errors if validation fails
 */
export function validateEnv(): Env {
  return validateEnvironment(envSchema);
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
