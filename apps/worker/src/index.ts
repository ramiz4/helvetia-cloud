import 'reflect-metadata';
import './load-env';

// Validate environment variables before doing anything else
import { initEnv } from './config/env';
initEnv();

import { logger } from 'shared';
import { scheduleCleanupJob } from './cleanup';
import { startHealthServer, stopHealthServer } from './health-server';
import { worker } from './worker';

logger.info('Worker started and listening for jobs...');

// Initialize cleanup scheduler
scheduleCleanupJob().catch((error) => {
  logger.error({ err: error }, 'Failed to schedule cleanup job');
});

// Start health check server
startHealthServer().catch((error) => {
  logger.error({ err: error }, 'Failed to start health check server');
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker gracefully...');
  await stopHealthServer();
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker gracefully...');
  await stopHealthServer();
  await worker.close();
  process.exit(0);
});
