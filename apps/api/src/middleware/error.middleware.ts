import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, ErrorCode } from '../errors';

/**
 * Global error handler middleware
 * Handles all errors and converts them to standard error response format
 */
export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Handle FST_ERR_CTP_BODY_TOO_LARGE error (Fastify body too large error)
  if ('code' in error && error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    const limit = error.message.match(/(\d+)/)?.[0] || 'unknown';
    const appError = new AppError(
      ErrorCode.PAYLOAD_TOO_LARGE,
      `Request body exceeds the maximum allowed size of ${Math.floor(parseInt(limit) / 1024 / 1024)}MB`,
      413,
    );
    return reply.status(413).send(appError.toJSON());
  }

  // Handle custom AppError instances
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    const validationError = new AppError(
      ErrorCode.VALIDATION_FAILED,
      'Request validation failed',
      400,
      error.validation,
    );
    return reply.status(400).send(validationError.toJSON());
  }

  // Log unexpected errors
  request.log.error(error, 'Unexpected error occurred');

  // Handle other errors with statusCode (like Fastify errors)
  const statusCode = (error as FastifyError).statusCode || 500;

  // Handle 429 Rate Limit Exceeded
  if (statusCode === 429) {
    const rateLimitError = new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, error.message, 429);
    return reply.status(429).send(rateLimitError.toJSON());
  }

  // Handle all other errors as internal server errors
  const systemError = new AppError(
    ErrorCode.SYSTEM_ERROR,
    process.env.NODE_ENV === 'production' && statusCode === 500 ? undefined : error.message,
    statusCode,
  );
  return reply.status(statusCode).send(systemError.toJSON());
}
