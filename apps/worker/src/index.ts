import 'reflect-metadata';
import './load-env.js';

// Validate environment variables before doing anything else
import { initEnv } from './config/env.js';
initEnv();

import { logger } from 'shared';
import { scheduleCleanupJob } from './cleanup.js';
import { startHealthServer, stopHealthServer } from './health-server.js';
import { subscriptionCheckWorker } from './subscriptionCheckWorker.js';
import { scheduleUsageCollection } from './usageCollection.js';
import { worker } from './worker.js';

logger.info('Worker started and listening for jobs...');

// Initialize cleanup scheduler
scheduleCleanupJob().catch((error) => {
  logger.error({ err: error }, 'Failed to schedule cleanup job');
});

// Initialize usage collection scheduler
scheduleUsageCollection().catch((error) => {
  logger.error({ err: error }, 'Failed to schedule usage collection job');
});

// Start health check server
startHealthServer().catch((error) => {
  logger.error({ err: error }, 'Failed to start health check server');
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker gracefully...');
  await stopHealthServer();
  const { usageCollectionWorker } = await import('./usageCollection.js');
  await Promise.all([
    worker.close(),
    usageCollectionWorker.close(),
    subscriptionCheckWorker.close(),
  ]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker gracefully...');
  await stopHealthServer();
  const { usageCollectionWorker } = await import('./usageCollection.js');
  await Promise.all([
    worker.close(),
    usageCollectionWorker.close(),
    subscriptionCheckWorker.close(),
  ]);
  process.exit(0);
});
