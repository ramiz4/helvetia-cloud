import { env, initEnv } from './config/env';
import './load-env';

// Validate environment variables before doing anything else
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
    if (err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') {
      try {
        process.kill(process.ppid);
      } catch (e) {
        console.error('Failed to kill parent process:', e);
      }
    }

    process.exit(1);
  }
};

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  console.log(`${signal} received, closing server gracefully...`);

  try {
    // Stop status reconciliation service
    statusReconciliationService.stop();

    // Close Fastify server (waits for in-flight requests to complete)
    await fastify.close();
    console.log('Fastify server closed');

    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
