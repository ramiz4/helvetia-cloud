import { scheduleCleanupJob } from './cleanup';
import { worker } from './worker';

console.log('Worker started and listening for jobs...');

// Initialize cleanup scheduler
scheduleCleanupJob().catch((error) => {
  console.error('Failed to schedule cleanup job:', error);
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker gracefully...');
  await worker.close();
  process.exit(0);
});
