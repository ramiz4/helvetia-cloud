import { Job, Queue, Worker } from 'bullmq';
import { prisma } from 'database';
import Docker from 'dockerode';
import dotenv from 'dotenv';
import { Redis } from 'ioredis';
import path from 'path';
import { DockerContainerOrchestrator, logger } from 'shared';
import { VolumeManager } from './orchestration/index.js';
import { cleanupDockerImages } from './services/imageCleanup.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create cleanup queue
export const cleanupQueue = new Queue('service-cleanup', {
  connection: redisConnection,
});

// Helper function to permanently delete a service
async function permanentlyDeleteService(id: string) {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) {
    logger.info(`Service ${id} not found, skipping deletion`);
    return;
  }

  logger.info(`Permanently deleting service ${service.name} (${id})`);

  const docker = new Docker();
  const orchestrator = new DockerContainerOrchestrator(docker);
  const volumeManager = new VolumeManager(docker);

  // 1. Stop and remove containers
  const containers = await orchestrator.listContainers({ all: true });
  const serviceContainers = containers.filter(
    (c) =>
      c.labels['helvetia.serviceId'] === id ||
      (service.type === 'COMPOSE' && c.labels['com.docker.compose.project'] === service.name),
  );

  for (const containerInfo of serviceContainers) {
    const container = await orchestrator.getContainer(containerInfo.id);
    logger.info(`Stopping and removing container ${containerInfo.id} for service ${id}`);
    await orchestrator.stopContainer(container).catch(() => {});
    await orchestrator.removeContainer(container).catch(() => {});
  }

  // 2. Clean up volumes
  const serviceType = service.type;
  if (serviceType && ['POSTGRES', 'REDIS', 'MYSQL'].includes(serviceType)) {
    const volumeName = `helvetia-data-${service.name}`;
    try {
      await volumeManager.removeVolume(volumeName);
      logger.info(`Removed volume ${volumeName} for service ${service.name}`);
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode !== 404) {
        logger.error({ err }, `Failed to remove volume ${volumeName}`);
      }
    }
  } else if (serviceType === 'COMPOSE') {
    try {
      const volumes = await volumeManager.listVolumes({
        label: [`com.docker.compose.project=${service.name}`],
      });

      for (const volumeInfo of volumes) {
        await volumeManager.removeVolume(volumeInfo.Name);
        logger.info(`Removed volume ${volumeInfo.Name} for compose project ${service.name}`);
      }
    } catch (err) {
      logger.error({ err }, `Failed to list/remove volumes for compose project ${service.name}`);
    }
  }

  // 3. Remove images
  const deployments = await prisma.deployment.findMany({
    where: { serviceId: id },
    select: { imageTag: true },
  });

  const imageTags = new Set(
    deployments.map((d) => d.imageTag).filter((tag): tag is string => !!tag),
  );

  for (const tag of imageTags) {
    try {
      const image = docker.getImage(tag as string);
      await image.remove({ force: true });
      logger.info(`Removed image ${tag}`);
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode !== 404) {
        logger.error({ err }, `Failed to remove image ${tag}`);
      }
    }
  }

  // 4. Delete from database
  await prisma.deployment.deleteMany({ where: { serviceId: id } });
  await prisma.service.delete({ where: { id } });

  logger.info(`Successfully deleted service ${service.name} (${id})`);
}

// Processor for the cleanup job
export const cleanupProcessor = async (_job: Job) => {
  logger.info('Running scheduled cleanup job for soft-deleted services and Docker images');

  // 1. Cleanup soft-deleted services
  logger.info('=== Service Cleanup Phase ===');
  // Find services deleted more than 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const servicesToDelete = await prisma.service.findMany({
    where: {
      deletedAt: {
        not: null,
        lt: thirtyDaysAgo,
      },
    },
  });

  logger.info(`Found ${servicesToDelete.length} services to permanently delete`);

  for (const service of servicesToDelete) {
    try {
      await permanentlyDeleteService(service.id);
    } catch (error) {
      logger.error({ err: error, serviceId: service.id }, 'Failed to delete service');
    }
  }

  // 2. Cleanup Docker images
  logger.info('=== Docker Image Cleanup Phase ===');
  const docker = new Docker();
  let imageCleanupResult;

  try {
    imageCleanupResult = await cleanupDockerImages(docker);
    logger.info(
      `Image cleanup completed: ${imageCleanupResult.danglingImagesRemoved} dangling, ${imageCleanupResult.oldImagesRemoved} old images removed`,
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to cleanup Docker images');
    imageCleanupResult = {
      danglingImagesRemoved: 0,
      oldImagesRemoved: 0,
      bytesFreed: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  return {
    deletedCount: servicesToDelete.length,
    imageCleanup: imageCleanupResult,
  };
};

// Worker to process cleanup jobs
export const cleanupWorker = new Worker('service-cleanup', cleanupProcessor, {
  connection: redisConnection,
});

// Schedule the cleanup job to run daily at 2 AM
export async function scheduleCleanupJob() {
  await cleanupQueue.add(
    'daily-cleanup',
    {},
    {
      repeat: {
        pattern: '0 2 * * *', // Cron: 2 AM daily
      },
    },
  );
  logger.info('Scheduled daily cleanup job for soft-deleted services and Docker images');
}
