import { z } from 'zod';

/**
 * Validation schema for service creation
 * Implements comprehensive input validation for security and data integrity
 */
export const ServiceCreateSchema = z.object({
  // Service name: lowercase alphanumeric with hyphens, DNS-compliant
  name: z
    .string()
    .min(3, 'Service name must be at least 3 characters')
    .max(63, 'Service name must not exceed 63 characters')
    .regex(
      /^[a-z0-9-]+$/,
      'Service name must contain only lowercase letters, numbers, and hyphens',
    ),

  // Repository URL: optional, must be valid URL
  repoUrl: z.string().url('Repository URL must be a valid URL').optional().or(z.literal('')),

  // Branch name: alphanumeric with common git ref characters
  branch: z
    .string()
    .min(1, 'Branch name must not be empty')
    .max(255, 'Branch name must not exceed 255 characters')
    .regex(
      /^[a-zA-Z0-9-_./]+$/,
      'Branch name must contain only alphanumeric characters, hyphens, underscores, dots, and slashes',
    )
    .optional(),

  // Build command: limit length to prevent abuse
  buildCommand: z
    .string()
    .max(1000, 'Build command must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),

  // Start command: limit length to prevent abuse
  startCommand: z
    .string()
    .max(1000, 'Start command must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),

  // Port: must be valid port number
  port: z
    .number()
    .int('Port must be an integer')
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must not exceed 65535')
    .optional(),

  // Environment variables: limit size to prevent abuse
  envVars: z
    .record(z.string(), z.string())
    .refine(
      (vars) => {
        const jsonSize = JSON.stringify(vars).length;
        return jsonSize <= 10000; // 10KB limit
      },
      {
        message: 'Environment variables size must not exceed 10KB',
      },
    )
    .optional(),

  // Custom domain: limit length
  customDomain: z
    .string()
    .max(255, 'Custom domain must not exceed 255 characters')
    .optional()
    .or(z.literal('')),

  // Service type: must be one of allowed types (case-insensitive)
  type: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(z.enum(['DOCKER', 'STATIC', 'POSTGRES', 'REDIS', 'MYSQL', 'COMPOSE']))
    .optional(),

  // Static output directory: limit length
  staticOutputDir: z
    .string()
    .max(255, 'Static output directory must not exceed 255 characters')
    .optional()
    .or(z.literal('')),
});

/**
 * Validation schema for service updates
 * All fields are optional for partial updates
 */
export const ServiceUpdateSchema = z.object({
  // Service name: lowercase alphanumeric with hyphens, DNS-compliant
  name: z
    .string()
    .min(3, 'Service name must be at least 3 characters')
    .max(63, 'Service name must not exceed 63 characters')
    .regex(/^[a-z0-9-]+$/, 'Service name must contain only lowercase letters, numbers, and hyphens')
    .optional(),

  // Repository URL: optional, must be valid URL
  repoUrl: z.string().url('Repository URL must be a valid URL').optional().or(z.literal('')),

  // Branch name: alphanumeric with common git ref characters
  branch: z
    .string()
    .min(1, 'Branch name must not be empty')
    .max(255, 'Branch name must not exceed 255 characters')
    .regex(
      /^[a-zA-Z0-9-_./]+$/,
      'Branch name must contain only alphanumeric characters, hyphens, underscores, dots, and slashes',
    )
    .optional(),

  // Build command: limit length to prevent abuse
  buildCommand: z
    .string()
    .max(1000, 'Build command must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),

  // Start command: limit length to prevent abuse
  startCommand: z
    .string()
    .max(1000, 'Start command must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),

  // Port: must be valid port number
  port: z
    .number()
    .int('Port must be an integer')
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must not exceed 65535')
    .optional(),

  // Environment variables: limit size to prevent abuse
  envVars: z
    .record(z.string(), z.string())
    .refine(
      (vars) => {
        const jsonSize = JSON.stringify(vars).length;
        return jsonSize <= 10000; // 10KB limit
      },
      {
        message: 'Environment variables size must not exceed 10KB',
      },
    )
    .optional(),

  // Custom domain: limit length
  customDomain: z
    .string()
    .max(255, 'Custom domain must not exceed 255 characters')
    .optional()
    .or(z.literal('')),

  // Service type: must be one of allowed types (case-insensitive)
  type: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(z.enum(['DOCKER', 'STATIC', 'POSTGRES', 'REDIS', 'MYSQL', 'COMPOSE']))
    .optional(),

  // Static output directory: limit length
  staticOutputDir: z
    .string()
    .max(255, 'Static output directory must not exceed 255 characters')
    .optional()
    .or(z.literal('')),
});

export type ServiceCreateInput = z.infer<typeof ServiceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof ServiceUpdateSchema>;
