import { AppError } from './AppError';

/**
 * Error thrown when user lacks permission to access a resource
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}
