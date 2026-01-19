import { env } from './config/env.js';
import './load-env.js';

// Environment variables are initialized in server.ts

import { STATUS_RECONCILIATION_INTERVAL_MS } from './config/constants.js';
import { resolve, TOKENS } from './di/index.js';
import { buildServer } from './server.js';
import { InitializationService } from './services/InitializationService.js';
import { scheduleSubscriptionChecks } from './services/SubscriptionCheckScheduler.js';
import { statusReconciliationService } from './utils/statusReconciliation.js';

let app: Awaited<ReturnType<typeof buildServer>>;

const start = async () => {
  try {
    app = await buildServer();

    // Run initializations
    const initService = resolve<InitializationService>(TOKENS.InitializationService);
    await initService.initialize();

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`API Server listening on port ${env.PORT}`);

    // Start status reconciliation service
    statusReconciliationService.start(STATUS_RECONCILIATION_INTERVAL_MS);

    // Schedule subscription checks
    await scheduleSubscriptionChecks();
    app.log.info('Subscription check scheduler initialized');
  } catch (err) {
    if (app) {
      app.log.error(err);
    } else {
      console.error(err);
    }

    // If the address is already in use, kill the parent process (likely the watcher)
    // to force an immediate exit instead of waiting for file changes.
    if (err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') {
      try {
        process.kill(process.ppid);
      } catch (e) {
        if (app) app.log.error(e, 'Failed to kill parent process');
      }
    }

    process.exit(1);
  }
};

// Graceful shutdown handlers
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    if (app) app.log.info(`${signal} received but shutdown already in progress`);
    return;
  }

  isShuttingDown = true;
  if (app) app.log.info(`${signal} received, closing server gracefully......`);

  try {
    // Stop status reconciliation service
    statusReconciliationService.stop();

    // Close subscription scheduler
    const { closeSubscriptionScheduler } = await import('./services/SubscriptionCheckScheduler.js');
    await closeSubscriptionScheduler();

    // Close Fastify server (waits for in-flight requests to complete)
    if (app) {
      await app.close();
      app.log.info('Fastify server closed');
    }

    process.exit(0);
  } catch (error) {
    if (app) {
      app.log.error(error, 'Error during graceful shutdown');
    } else {
      console.error('Error during graceful shutdown', error);
    }
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
