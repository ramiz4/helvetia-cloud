import type { FastifyPluginAsync } from 'fastify';
import { metricsService } from '../services/metrics.service';

/**
 * Metrics Routes
 *
 * Provides Prometheus metrics endpoint for monitoring
 */
export const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /metrics
   *
   * Returns metrics in Prometheus format for scraping
   * This endpoint is public (no authentication required)
   */
  fastify.get('/metrics', async (_request, reply) => {
    try {
      const metrics = await metricsService.getMetrics();
      reply.type('text/plain; version=0.0.4; charset=utf-8');
      return metrics;
    } catch (error) {
      fastify.log.error(error, 'Failed to collect metrics');
      return reply.status(500).send({ error: 'Failed to collect metrics' });
    }
  });

  /**
   * GET /metrics/json
   *
   * Returns metrics in JSON format for debugging
   * This endpoint is public (no authentication required)
   */
  fastify.get('/metrics/json', async (_request, reply) => {
    try {
      const metrics = await metricsService.getMetricsJSON();
      return metrics;
    } catch (error) {
      fastify.log.error(error, 'Failed to collect metrics');
      return reply.status(500).send({ error: 'Failed to collect metrics' });
    }
  });
};
