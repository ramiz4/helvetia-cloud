import { AppError } from './AppError.js';
import { ErrorCode } from './ErrorCodes.js';

/**
 * Error thrown when a resource conflict occurs (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message?: string, code: ErrorCode = ErrorCode.RESOURCE_CONFLICT) {
    super(code, message, 409);
  }
}
