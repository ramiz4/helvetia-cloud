/**
 * Standard error codes for the application
 * Format: CATEGORY_SPECIFIC_REASON
 *
 * Categories:
 * - AUTH_*: Authentication and authorization errors
 * - VALIDATION_*: Input validation errors
 * - RESOURCE_*: Resource-related errors (not found, conflict, etc.)
 * - SYSTEM_*: System and server errors
 * - RATE_LIMIT_*: Rate limiting errors
 */
export enum ErrorCode {
  // Authentication & Authorization (4xx)
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  AUTH_REFRESH_TOKEN_INVALID = 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',
  AUTH_GITHUB_FAILED = 'AUTH_GITHUB_FAILED',

  // Validation (4xx)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  VALIDATION_INVALID_INPUT = 'VALIDATION_INVALID_INPUT',
  VALIDATION_MISSING_FIELD = 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',

  // Resource Errors (4xx)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_DELETED = 'RESOURCE_DELETED',
  RESOURCE_PROTECTED = 'RESOURCE_PROTECTED',

  // Service-specific (4xx)
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
  SERVICE_NAME_TAKEN = 'SERVICE_NAME_TAKEN',
  SERVICE_PROTECTED = 'SERVICE_PROTECTED',
  SERVICE_UNAUTHORIZED = 'SERVICE_UNAUTHORIZED',

  // Deployment-specific (4xx)
  DEPLOYMENT_NOT_FOUND = 'DEPLOYMENT_NOT_FOUND',
  DEPLOYMENT_FAILED = 'DEPLOYMENT_FAILED',
  DEPLOYMENT_IN_PROGRESS = 'DEPLOYMENT_IN_PROGRESS',

  // Rate Limiting (4xx)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Payload (4xx)
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',

  // Subscription & Billing (4xx)
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_INACTIVE = 'SUBSCRIPTION_INACTIVE',
  SUBSCRIPTION_PAST_DUE = 'SUBSCRIPTION_PAST_DUE',
  SUBSCRIPTION_CANCELED = 'SUBSCRIPTION_CANCELED',
  SUBSCRIPTION_UNPAID = 'SUBSCRIPTION_UNPAID',

  // Resource Limits (4xx)
  LIMIT_SERVICE_COUNT_EXCEEDED = 'LIMIT_SERVICE_COUNT_EXCEEDED',
  LIMIT_MEMORY_EXCEEDED = 'LIMIT_MEMORY_EXCEEDED',
  LIMIT_CPU_EXCEEDED = 'LIMIT_CPU_EXCEEDED',
  LIMIT_BANDWIDTH_EXCEEDED = 'LIMIT_BANDWIDTH_EXCEEDED',
  LIMIT_STORAGE_EXCEEDED = 'LIMIT_STORAGE_EXCEEDED',

  // System & Server Errors (5xx)
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR',
  SYSTEM_DOCKER_ERROR = 'SYSTEM_DOCKER_ERROR',
  SYSTEM_GITHUB_API_ERROR = 'SYSTEM_GITHUB_API_ERROR',
  SYSTEM_REDIS_ERROR = 'SYSTEM_REDIS_ERROR',
}

/**
 * User-friendly error messages for each error code
 * Default English messages
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // Authentication & Authorization
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid username or password',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCode.AUTH_TOKEN_MISSING]: 'Authentication required. Please log in.',
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: 'Invalid refresh token. Please log in again.',
  [ErrorCode.AUTH_UNAUTHORIZED]: 'You are not authorized to access this resource',
  [ErrorCode.AUTH_FORBIDDEN]: 'You do not have permission to perform this action',
  [ErrorCode.AUTH_GITHUB_FAILED]: 'GitHub authentication failed. Please try again.',

  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'The provided data is invalid',
  [ErrorCode.VALIDATION_INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.VALIDATION_MISSING_FIELD]: 'Required field is missing',
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid format provided',

  // Resource Errors
  [ErrorCode.RESOURCE_NOT_FOUND]: 'The requested resource was not found',
  [ErrorCode.RESOURCE_CONFLICT]: 'A conflict occurred with the existing resource',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'A resource with this identifier already exists',
  [ErrorCode.RESOURCE_DELETED]: 'This resource has been deleted',
  [ErrorCode.RESOURCE_PROTECTED]: 'This resource is protected and cannot be modified',

  // Service-specific
  [ErrorCode.SERVICE_NOT_FOUND]: 'Service not found',
  [ErrorCode.SERVICE_NAME_TAKEN]: 'This service name is already taken',
  [ErrorCode.SERVICE_PROTECTED]: 'This service is protected from deletion',
  [ErrorCode.SERVICE_UNAUTHORIZED]: 'You do not have access to this service',

  // Deployment-specific
  [ErrorCode.DEPLOYMENT_NOT_FOUND]: 'Deployment not found',
  [ErrorCode.DEPLOYMENT_FAILED]: 'Deployment failed',
  [ErrorCode.DEPLOYMENT_IN_PROGRESS]: 'A deployment is already in progress',

  // Rate Limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later.',

  // Payload
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'Request payload is too large',

  // Subscription & Billing
  [ErrorCode.SUBSCRIPTION_NOT_FOUND]: 'No subscription found. Please subscribe to a plan.',
  [ErrorCode.SUBSCRIPTION_INACTIVE]: 'Your subscription is not active.',
  [ErrorCode.SUBSCRIPTION_PAST_DUE]:
    'Your subscription payment is past due. Please update your payment method.',
  [ErrorCode.SUBSCRIPTION_CANCELED]: 'Your subscription has been canceled.',
  [ErrorCode.SUBSCRIPTION_UNPAID]: 'Your subscription is unpaid. Please complete payment.',

  // Resource Limits
  [ErrorCode.LIMIT_SERVICE_COUNT_EXCEEDED]:
    'Service limit reached. Please upgrade your plan to create more services.',
  [ErrorCode.LIMIT_MEMORY_EXCEEDED]: 'Memory limit exceeded. Please upgrade your plan.',
  [ErrorCode.LIMIT_CPU_EXCEEDED]: 'CPU limit exceeded. Please upgrade your plan.',
  [ErrorCode.LIMIT_BANDWIDTH_EXCEEDED]: 'Bandwidth limit exceeded. Please upgrade your plan.',
  [ErrorCode.LIMIT_STORAGE_EXCEEDED]: 'Storage limit exceeded. Please upgrade your plan.',

  // System & Server Errors
  [ErrorCode.SYSTEM_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.SYSTEM_DATABASE_ERROR]: 'Database error occurred. Please try again.',
  [ErrorCode.SYSTEM_DOCKER_ERROR]: 'Container management error occurred',
  [ErrorCode.SYSTEM_GITHUB_API_ERROR]: 'GitHub API error. Please try again.',
  [ErrorCode.SYSTEM_REDIS_ERROR]: 'Cache service error. Please try again.',
};

/**
 * Get a user-friendly error message for an error code
 * @param code - Error code
 * @param customMessage - Optional custom message to override default
 * @returns User-friendly error message
 */
export function getErrorMessage(code: ErrorCode, customMessage?: string): string {
  return customMessage || ErrorMessages[code];
}
