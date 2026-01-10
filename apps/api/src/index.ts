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

    // If the address is already in use, kill the parent process (likely the watcher)
    // to force an immediate exit instead of waiting for file changes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any).code === 'EADDRINUSE') {
      try {
        process.kill(process.ppid);
      } catch (e) {
        console.error('Failed to kill parent process:', e);
      }
    }

    process.exit(1);
  }
};

start();
