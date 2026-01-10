import dotenv from 'dotenv';
import path from 'path';

// Load environment variables as early as possible
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

// Validate environment variables before doing anything else
import { env, initEnv } from './config/env';
initEnv();

import { STATUS_RECONCILIATION_INTERVAL_MS } from './config/constants';
import { fastify } from './server';
import { statusReconciliationService } from './utils/statusReconciliation';

const start = async () => {
  try {
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`API Server listening on port ${env.PORT}`);

    // Start status reconciliation service
    statusReconciliationService.start(STATUS_RECONCILIATION_INTERVAL_MS);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
