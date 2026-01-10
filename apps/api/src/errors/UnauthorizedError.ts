import { AppError } from './AppError';
import { ErrorCode } from './ErrorCodes';

/**
 * Error thrown when authentication fails or is missing
 */
export class UnauthorizedError extends AppError {
  constructor(message?: string, code: ErrorCode = ErrorCode.AUTH_UNAUTHORIZED) {
    super(code, message, 401);
  }
}
