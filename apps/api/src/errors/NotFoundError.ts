import { AppError } from './AppError';

/**
 * Error thrown when a requested resource is not found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}
