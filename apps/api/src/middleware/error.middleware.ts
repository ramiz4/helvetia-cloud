import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Error handler for body size limit exceeded
 */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  // Handle FST_ERR_CTP_BODY_TOO_LARGE error (Fastify body too large error)
  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    const limit = error.message.match(/(\d+)/)?.[0] || 'unknown';
    return reply.status(413).send({
      statusCode: 413,
      error: 'Payload Too Large',
      message: `Request body exceeds the maximum allowed size of ${Math.floor(parseInt(limit) / 1024 / 1024)}MB`,
    });
  }

  // Re-throw the error for other error handlers
  throw error;
}
