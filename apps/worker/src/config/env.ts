import { z } from 'zod';

/**
 * Environment variable schema for Worker service
 * Validates all required and optional environment variables on startup
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database Configuration
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),

  // Redis Configuration
  REDIS_URL: z.string().url().min(1, 'REDIS_URL is required'),

  // Platform Configuration
  PLATFORM_DOMAIN: z.string().default('helvetia.cloud'),

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
  MAX_LOG_SIZE_CHARS: z
    .string()
    .default('50000')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    ),
  WORKER_HEALTH_PORT: z
    .string()
    .default('3002')
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

  // Docker Configuration
  DOCKER_HOST: z.string().optional(),
  WORKSPACE_DIR: z.string().default('/tmp/helvetia-workspaces'),

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
