import { Queue, Worker } from 'bullmq';
import { prisma } from 'database';
import Docker from 'dockerode';
import dotenv from 'dotenv';
import IORedis from 'ioredis';
import path from 'path';
import { DockerContainerOrchestrator } from 'shared';
import { VolumeManager } from './orchestration';
import { cleanupDockerImages } from './services/imageCleanup';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
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
    console.log(`Service ${id} not found, skipping deletion`);
    return;
  }

  console.log(`Permanently deleting service ${service.name} (${id})`);

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
    console.log(`Stopping and removing container ${containerInfo.id} for service ${id}`);
    await orchestrator.stopContainer(container).catch(() => {});
    await orchestrator.removeContainer(container).catch(() => {});
  }

  // 2. Clean up volumes
  const serviceType = service.type;
  if (serviceType && ['POSTGRES', 'REDIS', 'MYSQL'].includes(serviceType)) {
    const volumeName = `helvetia-data-${service.name}`;
    try {
      await volumeManager.removeVolume(volumeName);
      console.log(`Removed volume ${volumeName} for service ${service.name}`);
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode !== 404) {
        console.error(`Failed to remove volume ${volumeName}:`, err);
      }
    }
  } else if (serviceType === 'COMPOSE') {
    try {
      const volumes = await volumeManager.listVolumes({
        label: [`com.docker.compose.project=${service.name}`],
      });

      for (const volumeInfo of volumes) {
        await volumeManager.removeVolume(volumeInfo.Name);
        console.log(`Removed volume ${volumeInfo.Name} for compose project ${service.name}`);
      }
    } catch (err) {
      console.error(`Failed to list/remove volumes for compose project ${service.name}:`, err);
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
      console.log(`Removed image ${tag}`);
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode !== 404) {
        console.error(`Failed to remove image ${tag}:`, err);
      }
    }
  }

  // 4. Delete from database
  await prisma.deployment.deleteMany({ where: { serviceId: id } });
  await prisma.service.delete({ where: { id } });

  console.log(`Successfully deleted service ${service.name} (${id})`);
}

// Worker to process cleanup jobs
export const cleanupWorker = new Worker(
  'service-cleanup',
  async (_job) => {
    console.log('Running scheduled cleanup job for soft-deleted services and Docker images');

    // 1. Cleanup soft-deleted services
    console.log('\n=== Service Cleanup Phase ===');
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

    console.log(`Found ${servicesToDelete.length} services to permanently delete`);

    for (const service of servicesToDelete) {
      try {
        await permanentlyDeleteService(service.id);
      } catch (error) {
        console.error(`Failed to delete service ${service.id}:`, error);
      }
    }

    // 2. Cleanup Docker images
    console.log('\n=== Docker Image Cleanup Phase ===');
    const docker = new Docker();
    let imageCleanupResult;

    try {
      imageCleanupResult = await cleanupDockerImages(docker);
      console.log(
        `Image cleanup completed: ${imageCleanupResult.danglingImagesRemoved} dangling, ${imageCleanupResult.oldImagesRemoved} old images removed`,
      );
    } catch (error) {
      console.error('Failed to cleanup Docker images:', error);
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
  },
  { connection: redisConnection },
);

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
  console.log('Scheduled daily cleanup job for soft-deleted services and Docker images');
}
