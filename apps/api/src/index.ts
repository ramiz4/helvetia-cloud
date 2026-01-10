import { fastify } from './server';
import { statusReconciliationService } from './utils/statusReconciliation';

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`API Server listening on port ${port}`);

    // Start status reconciliation service
    statusReconciliationService.start(30000); // Run every 30 seconds
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
