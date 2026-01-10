import { fastify } from './server';
import { statusReconciliationService } from './utils/statusReconciliation';
import { STATUS_RECONCILIATION_INTERVAL_MS } from './config/constants';

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`API Server listening on port ${port}`);

    // Start status reconciliation service
    statusReconciliationService.start(STATUS_RECONCILIATION_INTERVAL_MS);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
