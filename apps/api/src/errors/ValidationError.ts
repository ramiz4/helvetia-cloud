import { AppError } from './AppError';

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends AppError {
  public readonly validationErrors?: unknown;

  constructor(message: string = 'Validation failed', validationErrors?: unknown) {
    super(message, 400);
    this.validationErrors = validationErrors;
  }
}
