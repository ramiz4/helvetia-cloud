import { z } from 'zod';

/**
 * Helper for optional string fields that should treat empty strings as undefined
 */
const optionalString = (schema: z.ZodString) =>
  schema
    .nullable()
    .optional()
    .transform((val) => (val === '' || val === null ? undefined : val));

/**
 * Common field validations shared between create and update schemas
 */
const commonFieldValidations = {
  name: z
    .string()
    .min(2, 'Service name must be at least 2 characters')
    .max(63, 'Service name must not exceed 63 characters')
    .regex(
      /^[a-z0-9-]+$/,
      'Service name must contain only lowercase letters, numbers, and hyphens',
    ),
  repoUrl: optionalString(
    z
      .string()
      .min(1, 'Repository URL must not be empty')
      .max(2000, 'Repository URL must not exceed 2000 characters'),
  ),
  branch: optionalString(
    z
      .string()
      .min(1, 'Branch name must not be empty')
      .max(255, 'Branch name must not exceed 255 characters')
      .regex(
        /^[a-zA-Z0-9-_./]+$/,
        'Branch name must contain only alphanumeric characters, hyphens, underscores, dots, and slashes',
      ),
  ),
  buildCommand: optionalString(
    z.string().max(1000, 'Build command must not exceed 1000 characters'),
  ),
  startCommand: optionalString(
    z.string().max(1000, 'Start command must not exceed 1000 characters'),
  ),
  port: z
    .number()
    .int('Port must be an integer')
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must not exceed 65535')
    .optional(),
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
  customDomain: optionalString(z.string().max(255, 'Custom domain must not exceed 255 characters')),
  type: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(z.enum(['DOCKER', 'STATIC', 'POSTGRES', 'REDIS', 'MYSQL', 'COMPOSE']))
    .optional(),
  staticOutputDir: optionalString(
    z.string().max(255, 'Static output directory must not exceed 255 characters'),
  ),
  volumes: z.array(z.string()).optional(),
};

/**
 * Validation schema for service creation
 * Implements comprehensive input validation for security and data integrity
 */
export const ServiceCreateSchema = z.object({
  // Service name: lowercase alphanumeric with hyphens, DNS-compliant
  name: commonFieldValidations.name,

  // Repository URL: optional, must be valid URL
  repoUrl: commonFieldValidations.repoUrl,

  // Branch name: alphanumeric with common git ref characters
  branch: commonFieldValidations.branch,

  // Build command: limit length to prevent abuse
  buildCommand: commonFieldValidations.buildCommand,

  // Start command: limit length to prevent abuse
  startCommand: commonFieldValidations.startCommand,

  // Port: must be valid port number
  port: commonFieldValidations.port,

  // Environment variables: limit size to prevent abuse
  envVars: commonFieldValidations.envVars,

  // Custom domain: limit length
  customDomain: commonFieldValidations.customDomain,

  // Service type: must be one of allowed types (case-insensitive)
  type: commonFieldValidations.type,

  // Static output directory: limit length
  staticOutputDir: commonFieldValidations.staticOutputDir,

  // Volumes: list of bind mounts or named volumes
  volumes: commonFieldValidations.volumes,

  // Helper fields for COMPOSE type (mapped to buildCommand and startCommand)
  composeFile: optionalString(
    z.string().max(255, 'Compose file path must not exceed 255 characters'),
  ),
  mainService: optionalString(
    z.string().max(63, 'Main service name must not exceed 63 characters'),
  ),
  environmentId: z.string().uuid('Invalid environment ID').optional(),
});

/**
 * Validation schema for service updates
 * All fields are optional for partial updates
 */
export const ServiceUpdateSchema = z.object({
  // Service name: lowercase alphanumeric with hyphens, DNS-compliant
  name: commonFieldValidations.name.optional(),

  // Repository URL: optional, must be valid URL
  repoUrl: commonFieldValidations.repoUrl,

  // Branch name: alphanumeric with common git ref characters
  branch: commonFieldValidations.branch,

  // Build command: limit length to prevent abuse
  buildCommand: commonFieldValidations.buildCommand,

  // Start command: limit length to prevent abuse
  startCommand: commonFieldValidations.startCommand,

  // Port: must be valid port number
  port: commonFieldValidations.port,

  // Environment variables: limit size to prevent abuse
  envVars: commonFieldValidations.envVars,

  // Custom domain: limit length
  customDomain: commonFieldValidations.customDomain,

  // Service type: must be one of allowed types (case-insensitive)
  type: commonFieldValidations.type,

  // Static output directory: limit length
  staticOutputDir: commonFieldValidations.staticOutputDir,

  // Volumes: list of bind mounts or named volumes
  volumes: commonFieldValidations.volumes,

  environmentId: z.string().uuid('Invalid environment ID').optional(),
});

/**
 * Validation schema for toggling service delete protection
 */
export const ProtectionToggleSchema = z.object({
  deleteProtected: z.boolean({
    required_error: 'deleteProtected field is required',
    invalid_type_error: 'deleteProtected must be a boolean',
  }),
});

export type ServiceCreateInput = z.infer<typeof ServiceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof ServiceUpdateSchema>;
export type ProtectionToggleInput = z.infer<typeof ProtectionToggleSchema>;
