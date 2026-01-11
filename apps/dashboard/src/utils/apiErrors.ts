/**
 * Standard error codes from the API
 * These match the backend error codes in apps/api/src/errors/ErrorCodes.ts
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

  // System & Server Errors (5xx)
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR',
  SYSTEM_DOCKER_ERROR = 'SYSTEM_DOCKER_ERROR',
  SYSTEM_GITHUB_API_ERROR = 'SYSTEM_GITHUB_API_ERROR',
  SYSTEM_REDIS_ERROR = 'SYSTEM_REDIS_ERROR',
}

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

/**
 * Check if a response is an API error response
 */
export function isApiError(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    data.success === false &&
    'error' in data &&
    typeof data.error === 'object' &&
    data.error !== null &&
    'code' in data.error &&
    'message' in data.error &&
    'statusCode' in data.error
  );
}

/**
 * User-friendly error messages for display
 * These can be customized based on the application's UX requirements
 */
export const UserFriendlyErrorMessages: Partial<Record<ErrorCode, string>> = {
  // Authentication
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.AUTH_TOKEN_INVALID]: 'Your session is invalid. Please log in again.',
  [ErrorCode.AUTH_TOKEN_MISSING]: 'Please log in to continue.',
  [ErrorCode.AUTH_UNAUTHORIZED]: 'You need to be logged in to access this.',
  [ErrorCode.AUTH_FORBIDDEN]: "You don't have permission to do that.",
  [ErrorCode.AUTH_GITHUB_FAILED]: 'GitHub authentication failed. Please try again.',

  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'Please check your input and try again.',
  [ErrorCode.VALIDATION_INVALID_INPUT]: 'Some information you provided is invalid.',

  // Services
  [ErrorCode.SERVICE_NOT_FOUND]: 'Service not found.',
  [ErrorCode.SERVICE_NAME_TAKEN]: 'This service name is already taken.',
  [ErrorCode.SERVICE_PROTECTED]: 'This service is protected. Remove protection first to delete it.',

  // Deployments
  [ErrorCode.DEPLOYMENT_IN_PROGRESS]: 'A deployment is already running for this service.',
  [ErrorCode.DEPLOYMENT_FAILED]: 'Deployment failed. Check the logs for details.',

  // System
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCode.PAYLOAD_TOO_LARGE]: "The file or data you're uploading is too large.",
  [ErrorCode.SYSTEM_ERROR]: 'Something went wrong. Please try again later.',
};

/**
 * Get a user-friendly error message from an API error response
 */
export function getUserFriendlyErrorMessage(error: ApiErrorResponse): string {
  // Try to get a custom user-friendly message
  const customMessage = UserFriendlyErrorMessages[error.error.code];
  if (customMessage) {
    return customMessage;
  }

  // Fall back to the API message
  return error.error.message;
}

/**
 * Parse an error response from a fetch call
 */
export async function parseApiError(response: Response): Promise<ApiErrorResponse | null> {
  try {
    const data = await response.json();
    if (isApiError(data)) {
      return data;
    }
  } catch {
    // If parsing fails, return null
  }
  return null;
}

/**
 * Handle API errors with common patterns
 */
export async function handleApiError(
  response: Response,
  options?: {
    onTokenExpired?: () => void | Promise<void>;
    onForbidden?: () => void | Promise<void>;
    onNotFound?: () => void | Promise<void>;
    onValidationError?: (details: unknown) => void | Promise<void>;
    onRateLimitExceeded?: () => void | Promise<void>;
    onError?: (error: ApiErrorResponse) => void | Promise<void>;
  },
): Promise<void> {
  const error = await parseApiError(response);

  if (!error) {
    // Generic HTTP error
    console.error('API request failed:', response.status, response.statusText);
    return;
  }

  // Handle specific error codes
  switch (error.error.code) {
    case ErrorCode.AUTH_TOKEN_EXPIRED:
    case ErrorCode.AUTH_TOKEN_INVALID:
      await options?.onTokenExpired?.();
      break;

    case ErrorCode.AUTH_FORBIDDEN:
    case ErrorCode.SERVICE_UNAUTHORIZED:
      await options?.onForbidden?.();
      break;

    case ErrorCode.RESOURCE_NOT_FOUND:
    case ErrorCode.SERVICE_NOT_FOUND:
    case ErrorCode.DEPLOYMENT_NOT_FOUND:
      await options?.onNotFound?.();
      break;

    case ErrorCode.VALIDATION_FAILED:
      await options?.onValidationError?.(error.error.details);
      break;

    case ErrorCode.RATE_LIMIT_EXCEEDED:
      await options?.onRateLimitExceeded?.();
      break;

    default:
      await options?.onError?.(error);
      break;
  }
}
