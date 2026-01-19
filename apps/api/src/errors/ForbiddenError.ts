import { AppError } from './AppError.js';
import { ErrorCode } from './ErrorCodes.js';

/**
 * Error thrown when user lacks permission to access a resource
 */
export class ForbiddenError extends AppError {
  constructor(message?: string, code: ErrorCode = ErrorCode.AUTH_FORBIDDEN) {
    super(code, message, 403);
  }
}
