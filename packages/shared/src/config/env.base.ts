import { z } from 'zod';

/**
 * Helper to create integer schema from string environment variable
 */
export const intFromString = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .pipe(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val, 10)),
    );

/**
 * Helper to create float schema from string environment variable
 */
export const floatFromString = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .pipe(
      z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .transform((val) => parseFloat(val)),
    );

/**
 * Base environment schema shared across API and Worker services
 * Contains common environment variables used by both services
 */
export const baseEnvSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database Configuration
  DATABASE_URL: z.url().min(1, 'DATABASE_URL is required'),

  // Redis Configuration
  REDIS_URL: z.url().min(1, 'REDIS_URL is required'),

  // Platform Configuration
  PLATFORM_DOMAIN: z.string().default('helvetia.cloud'),

  // Container Resource Limits (used by both API and Worker)
  CONTAINER_MEMORY_LIMIT_MB: intFromString('512'),
  CONTAINER_CPU_CORES: floatFromString('1.0'),

  // Distributed Lock Configuration (shared between API and Worker)
  STATUS_LOCK_TTL_MS: intFromString('10000'),
  LOCK_RETRY_DELAY_MS: intFromString('200'),
  LOCK_RETRY_JITTER_MS: intFromString('100'),

  // Test Environment
  VITEST: z.string().optional(),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Common validation function that can be used by both API and Worker
 * @param schema - Zod schema to validate against
 * @param env - Environment object to validate (defaults to process.env)
 * @returns Validated environment configuration
 * @throws {Error} with detailed validation errors if validation fails
 */
export function validateEnvironment<T>(schema: z.ZodSchema<T>, env = process.env): T {
  try {
    return schema.parse(env);
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
