import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with default values', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });

    it('should create an error with custom status code', () => {
      const error = new AppError('Test error', 418);

      expect(error.statusCode).toBe(418);
      expect(error.isOperational).toBe(true);
    });

    it('should create an error with custom operational flag', () => {
      const error = new AppError('Test error', 500, false);

      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });

    it('should maintain proper stack trace', () => {
      const error = new AppError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with default message', () => {
      const error = new ValidationError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });

    it('should create a validation error with custom message', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should include validation errors', () => {
      const validationErrors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ];
      const error = new ValidationError('Validation failed', validationErrors);

      expect(error.validationErrors).toEqual(validationErrors);
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error with default message', () => {
      const error = new NotFoundError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });

    it('should create a not found error with custom message', () => {
      const error = new NotFoundError('User not found');

      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create an unauthorized error with default message', () => {
      const error = new UnauthorizedError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should create an unauthorized error with custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('should create a forbidden error with default message', () => {
      const error = new ForbiddenError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('ForbiddenError');
    });

    it('should create a forbidden error with custom message', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('ConflictError', () => {
    it('should create a conflict error with default message', () => {
      const error = new ConflictError();

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Resource conflict');
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('ConflictError');
    });

    it('should create a conflict error with custom message', () => {
      const error = new ConflictError('User already exists');

      expect(error.message).toBe('User already exists');
      expect(error.statusCode).toBe(409);
    });
  });
});
