import { AppError } from './AppError';
import { ErrorCode } from './ErrorCodes';

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends AppError {
  constructor(message?: string, details?: unknown) {
    super(ErrorCode.VALIDATION_FAILED, message, 400, details);
  }
}
