import { baseEnvSchema, intFromString, validateEnvironment } from 'shared';
import { z } from 'zod';

/**
 * Environment variable schema for Worker service
 * Extends base schema with Worker-specific environment variables
 */
const envSchema = baseEnvSchema.extend({
  // Service Configuration
  MAX_LOG_SIZE_CHARS: intFromString('50000'),
  WORKER_HEALTH_PORT: intFromString('3003'),

  // Docker Configuration
  DOCKER_HOST: z.string().optional(),
  WORKSPACE_DIR: z.string().default('/tmp/helvetia-workspaces'),

  // Docker Image Cleanup Configuration
  IMAGE_RETENTION_DAYS: intFromString('7'),
  DISK_USAGE_THRESHOLD_PERCENT: z
    .string()
    .default('80')
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10))
        .refine((val) => val >= 0 && val <= 100, {
          message: 'DISK_USAGE_THRESHOLD_PERCENT must be between 0 and 100',
        }),
    ),
  CLEANUP_DANGLING_IMAGES: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  CLEANUP_OLD_IMAGES: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
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
