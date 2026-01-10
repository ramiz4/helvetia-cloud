import { AppError } from './AppError';

/**
 * Error thrown when authentication fails or is missing
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}
