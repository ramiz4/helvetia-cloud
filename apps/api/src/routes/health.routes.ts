import type { FastifyPluginAsync } from 'fastify';

/**
 * Health check route
 * Simple endpoint to check if the API is running
 */
export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });
};
