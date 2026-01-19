import { AppError } from './AppError.js';
import { ErrorCode } from './ErrorCodes.js';

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends AppError {
  constructor(message?: string, code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND) {
    super(code, message, 404);
  }
}
