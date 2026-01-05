import { worker } from './worker';

console.log('Worker started and listening for jobs...');

// Keep the process alive
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  process.exit(0);
});
