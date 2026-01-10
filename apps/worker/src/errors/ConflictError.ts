import { AppError } from './AppError';

/**
 * Error thrown when a resource conflict occurs (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}
