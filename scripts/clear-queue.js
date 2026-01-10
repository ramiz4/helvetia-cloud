const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

async function clearQueue() {
  const queue = new Queue('deployments', { connection });
  console.log('Clearing "deployments" queue...');
  await queue.drain();
  await queue.clean(0, 1000, 'completed');
  await queue.clean(0, 1000, 'failed');
  await queue.clean(0, 1000, 'wait');
  await queue.clean(0, 1000, 'active');
  console.log('Queue cleared.');
  await connection.quit();
}

clearQueue().catch((err) => {
  console.error(err);
  process.exit(1);
});
