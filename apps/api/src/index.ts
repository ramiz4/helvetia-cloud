import { env } from './config/env';
import './load-env';

// Environment variables are initialized in server.ts

import { STATUS_RECONCILIATION_INTERVAL_MS } from './config/constants';
import { resolve, TOKENS } from './di';
import { fastify } from './server';
import { InitializationService } from './services/InitializationService';
import { scheduleSubscriptionChecks } from './services/SubscriptionCheckScheduler';
import { statusReconciliationService } from './utils/statusReconciliation';

const start = async () => {
  try {
    // Run initializations
    const initService = resolve<InitializationService>(TOKENS.InitializationService);
    await initService.initialize();

    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    fastify.log.info(`API Server listening on port ${env.PORT}`);

    // Start status reconciliation service
    statusReconciliationService.start(STATUS_RECONCILIATION_INTERVAL_MS);

    // Schedule subscription checks
    await scheduleSubscriptionChecks();
    fastify.log.info('Subscription check scheduler initialized');
  } catch (err) {
    fastify.log.error(err);

    // If the address is already in use, kill the parent process (likely the watcher)
    // to force an immediate exit instead of waiting for file changes.
    if (err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') {
      try {
        process.kill(process.ppid);
      } catch (e) {
        fastify.log.error(e, 'Failed to kill parent process');
      }
    }

    process.exit(1);
  }
};

// Graceful shutdown handlers
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    fastify.log.info(`${signal} received but shutdown already in progress`);
    return;
  }

  isShuttingDown = true;
  fastify.log.info(`${signal} received, closing server gracefully...`);

  try {
    // Stop status reconciliation service
    statusReconciliationService.stop();

    // Close subscription scheduler
    const { closeSubscriptionScheduler } = await import('./services/SubscriptionCheckScheduler.js');
    await closeSubscriptionScheduler();

    // Close Fastify server (waits for in-flight requests to complete)
    await fastify.close();
    fastify.log.info('Fastify server closed');

    process.exit(0);
  } catch (error) {
    fastify.log.error(error, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
