import dotenv from 'dotenv';
import path from 'path';

// Load environment variables as early as possible
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

import { STATUS_RECONCILIATION_INTERVAL_MS } from './config/constants';
import { fastify } from './server';
import { statusReconciliationService } from './utils/statusReconciliation';

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
