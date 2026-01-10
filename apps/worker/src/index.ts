import { scheduleCleanupJob } from './cleanup';
import { startHealthServer, stopHealthServer } from './health-server';
import { worker } from './worker';

console.log('Worker started and listening for jobs...');

// Initialize cleanup scheduler
scheduleCleanupJob().catch((error) => {
  console.error('Failed to schedule cleanup job:', error);
});

// Start health check server
startHealthServer().catch((error) => {
  console.error('Failed to start health check server:', error);
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker gracefully...');
  await stopHealthServer();
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker gracefully...');
  await stopHealthServer();
  await worker.close();
  process.exit(0);
});
