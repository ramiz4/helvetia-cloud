import { z } from 'zod';

/**
 * Environment variable schema for Dashboard (Next.js)
 * Validates all required and optional NEXT_PUBLIC_* environment variables
 */
const envSchema = z.object({
  // Next.js Public Environment Variables
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_WS_URL: z.string().default('ws://localhost:3001'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_GITHUB_CLIENT_ID: z.string().optional(),

  // Node Environment (available at build time)
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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

// Validate environment variables at module load time (build time for Next.js)
const validatedEnv = validateEnv();

// Export validated environment configuration
export const env = validatedEnv;

// Export individual config values for backward compatibility
export const API_BASE_URL = env.NEXT_PUBLIC_API_URL;
export const WS_BASE_URL = env.NEXT_PUBLIC_WS_URL;
export const APP_BASE_URL = env.NEXT_PUBLIC_APP_URL;
export const GITHUB_CLIENT_ID = env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
