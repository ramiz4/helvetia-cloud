import { AppError } from './AppError';
import { ErrorCode } from './ErrorCodes';

/**
 * Error thrown when user lacks permission to access a resource
 */
export class ForbiddenError extends AppError {
  constructor(message?: string, code: ErrorCode = ErrorCode.AUTH_FORBIDDEN) {
    super(code, message, 403);
  }
}
