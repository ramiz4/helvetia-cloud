import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors/index.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with error code and default message', () => {
      const error = new AppError(ErrorCode.SYSTEM_ERROR);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('An unexpected error occurred. Please try again.');
      expect(error.code).toBe(ErrorCode.SYSTEM_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });

    it('should create an error with custom message', () => {
      const error = new AppError(ErrorCode.SYSTEM_ERROR, 'Custom error message');

      expect(error.message).toBe('Custom error message');
      expect(error.code).toBe(ErrorCode.SYSTEM_ERROR);
      expect(error.statusCode).toBe(500);
    });

    it('should create an error with custom status code', () => {
      const error = new AppError(ErrorCode.SYSTEM_ERROR, 'Test error', 418);

      expect(error.statusCode).toBe(418);
      expect(error.isOperational).toBe(true);
    });

    it('should create an error with details', () => {
      const details = { field: 'email', message: 'Invalid email' };
      const error = new AppError(ErrorCode.VALIDATION_FAILED, undefined, 400, details);

      expect(error.details).toEqual(details);
    });

    it('should create an error with custom operational flag', () => {
      const error = new AppError(ErrorCode.SYSTEM_ERROR, undefined, 500, undefined, false);

      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });

    it('should maintain proper stack trace', () => {
      const error = new AppError(ErrorCode.SYSTEM_ERROR);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should convert to JSON format', () => {
      const error = new AppError(ErrorCode.VALIDATION_FAILED, 'Invalid input', 400, {
        field: 'email',
      });
      const json = error.toJSON();

      expect(json).toEqual({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid input',
          statusCode: 400,
          details: { field: 'email' },
        },
      });
    });

    it('should convert to JSON format without details', () => {
      const error = new AppError(ErrorCode.SYSTEM_ERROR);
      const json = error.toJSON();

      expect(json).toEqual({
        success: false,
        error: {
          code: ErrorCode.SYSTEM_ERROR,
          message: 'An unexpected error occurred. Please try again.',
          statusCode: 500,
        },
      });
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with default message', () => {
      const error = new ValidationError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('The provided data is invalid');
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });

    it('should create a validation error with custom message', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.statusCode).toBe(400);
    });

    it('should include validation details', () => {
      const details = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ];
      const error = new ValidationError('Validation failed', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error with default message', () => {
      const error = new NotFoundError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('The requested resource was not found');
      expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });

    it('should create a not found error with custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.message).toBe('User not found');
      expect(error.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(error.statusCode).toBe(404);
    });

    it('should create a not found error with custom code', () => {
      const error = new NotFoundError('Service not found', ErrorCode.SERVICE_NOT_FOUND);

      expect(error.message).toBe('Service not found');
      expect(error.code).toBe(ErrorCode.SERVICE_NOT_FOUND);
      expect(error.statusCode).toBe(404);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create an unauthorized error with default message', () => {
      const error = new UnauthorizedError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toBe('You are not authorized to access this resource');
      expect(error.code).toBe(ErrorCode.AUTH_UNAUTHORIZED);
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should create an unauthorized error with custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.message).toBe('Invalid token');
      expect(error.code).toBe(ErrorCode.AUTH_UNAUTHORIZED);
      expect(error.statusCode).toBe(401);
    });

    it('should create an unauthorized error with custom code', () => {
      const error = new UnauthorizedError('Token expired', ErrorCode.AUTH_TOKEN_EXPIRED);

      expect(error.message).toBe('Token expired');
      expect(error.code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('should create a forbidden error with default message', () => {
      const error = new ForbiddenError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toBe('You do not have permission to perform this action');
      expect(error.code).toBe(ErrorCode.AUTH_FORBIDDEN);
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('ForbiddenError');
    });

    it('should create a forbidden error with custom message', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.message).toBe('Access denied');
      expect(error.code).toBe(ErrorCode.AUTH_FORBIDDEN);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('ConflictError', () => {
    it('should create a conflict error with default message', () => {
      const error = new ConflictError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('A conflict occurred with the existing resource');
      expect(error.code).toBe(ErrorCode.RESOURCE_CONFLICT);
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('ConflictError');
    });

    it('should create a conflict error with custom message', () => {
      const error = new ConflictError('User already exists');

      expect(error.message).toBe('User already exists');
      expect(error.code).toBe(ErrorCode.RESOURCE_CONFLICT);
      expect(error.statusCode).toBe(409);
    });
  });
});
