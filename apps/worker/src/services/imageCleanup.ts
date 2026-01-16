import { prisma } from 'database';
import Docker from 'dockerode';
import { logger } from 'shared';
import {
  CLEANUP_DANGLING_IMAGES,
  CLEANUP_OLD_IMAGES,
  DISK_USAGE_THRESHOLD_PERCENT,
  IMAGE_RETENTION_DAYS,
} from '../config/constants';

export interface CleanupResult {
  danglingImagesRemoved: number;
  oldImagesRemoved: number;
  bytesFreed: number;
  errors: string[];
}

export interface DiskUsage {
  usedPercent: number;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

/**
 * Get disk usage information from Docker
 */
export async function getDockerDiskUsage(docker: Docker): Promise<DiskUsage> {
  try {
    // Docker info doesn't provide disk usage directly, so we calculate based on image sizes
    const images = await docker.listImages({ all: true });
    const usedBytes = images.reduce((total, image) => total + (image.Size || 0), 0);

    // We can't get exact disk info from Docker API, so we return image storage usage
    // This is a limitation of the Docker API
    return {
      usedPercent: 0, // Will be set by caller if they have access to system info
      totalBytes: 0,
      usedBytes,
      freeBytes: 0,
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to get Docker disk usage');
    return {
      usedPercent: 0,
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
    };
  }
}

/**
 * Remove dangling images (images with <none> tag)
 */
export async function removeDanglingImages(docker: Docker): Promise<{
  count: number;
  bytesFreed: number;
  errors: string[];
}> {
  if (!CLEANUP_DANGLING_IMAGES) {
    logger.info('Dangling image cleanup is disabled');
    return { count: 0, bytesFreed: 0, errors: [] };
  }

  logger.info('Scanning for dangling images...');
  const errors: string[] = [];
  let count = 0;
  let bytesFreed = 0;

  try {
    // List all dangling images (untagged and unused)
    const images = await docker.listImages({
      filters: JSON.stringify({ dangling: ['true'] }),
    });

    logger.info(`Found ${images.length} dangling images`);

    for (const imageInfo of images) {
      try {
        const image = docker.getImage(imageInfo.Id);
        const imageSize = imageInfo.Size || 0;

        await image.remove({ force: false });
        count++;
        bytesFreed += imageSize;
        logger.info(
          `Removed dangling image ${imageInfo.Id.substring(0, 12)} (${(imageSize / 1024 / 1024).toFixed(2)} MB)`,
        );
      } catch (error) {
        const errorMsg = `Failed to remove dangling image ${imageInfo.Id}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }
  } catch (error) {
    const errorMsg = 'Failed to list dangling images';
    logger.error({ err: error }, errorMsg);
    errors.push(`${errorMsg}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { count, bytesFreed, errors };
}

/**
 * Remove old image versions based on retention policy
 */
export async function removeOldImages(docker: Docker): Promise<{
  count: number;
  bytesFreed: number;
  errors: string[];
}> {
  if (!CLEANUP_OLD_IMAGES) {
    logger.info('Old image cleanup is disabled');
    return { count: 0, bytesFreed: 0, errors: [] };
  }

  logger.info(`Scanning for images older than ${IMAGE_RETENTION_DAYS} days...`);
  const errors: string[] = [];
  let count = 0;
  let bytesFreed = 0;

  try {
    // Calculate retention cutoff date
    const retentionCutoff = new Date();
    retentionCutoff.setDate(retentionCutoff.getDate() - IMAGE_RETENTION_DAYS);

    // Find deployments older than retention period
    const oldDeployments = await prisma.deployment.findMany({
      where: {
        createdAt: {
          lt: retentionCutoff,
        },
        imageTag: {
          not: null,
        },
      },
      select: {
        id: true,
        imageTag: true,
        serviceId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    logger.info(`Found ${oldDeployments.length} old deployments to check`);

    // Get list of currently running containers to avoid removing their images
    const runningContainers = await docker.listContainers({ all: false });
    const activeImageIds = new Set<string>();

    for (const container of runningContainers) {
      if (container.ImageID) {
        activeImageIds.add(container.ImageID);
      }
    }

    // Track images we've already processed to avoid duplicates
    const processedImages = new Set<string>();

    for (const deployment of oldDeployments) {
      const imageTag = deployment.imageTag;
      if (!imageTag || processedImages.has(imageTag)) {
        continue;
      }

      processedImages.add(imageTag);

      try {
        // Check if this is the latest deployment for the service
        const latestDeployment = await prisma.deployment.findFirst({
          where: {
            serviceId: deployment.serviceId,
            status: 'SUCCESS',
            imageTag: {
              not: null,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            imageTag: true,
          },
        });

        // Don't remove the latest successful deployment's image
        if (latestDeployment && latestDeployment.imageTag === imageTag) {
          logger.info(
            `Skipping ${imageTag} - it's the latest deployment for service ${deployment.serviceId}`,
          );
          continue;
        }

        // Try to get the image
        const image = docker.getImage(imageTag);
        const imageData = await image.inspect().catch(() => null);

        if (!imageData) {
          logger.info(`Image ${imageTag} not found, may have been already removed`);
          continue;
        }

        // Don't remove if image is currently in use
        if (activeImageIds.has(imageData.Id)) {
          logger.info(`Skipping ${imageTag} - image is currently in use`);
          continue;
        }

        const imageSize = imageData.Size || 0;

        // Remove the image
        await image.remove({ force: false });
        count++;
        bytesFreed += imageSize;
        logger.info(
          `Removed old image ${imageTag} from deployment ${deployment.id} (${(imageSize / 1024 / 1024).toFixed(2)} MB, created ${deployment.createdAt.toISOString()})`,
        );
      } catch (error) {
        // If error is 409 (conflict), the image is being used by a container
        const dockerError = error as { statusCode?: number };
        if (dockerError.statusCode === 409) {
          logger.info(`Skipping ${imageTag} - image is in use by a container`);
          continue;
        }

        const errorMsg = `Failed to remove old image ${imageTag}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }
  } catch (error) {
    const errorMsg = 'Failed to cleanup old images';
    logger.error({ err: error }, errorMsg);
    errors.push(`${errorMsg}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { count, bytesFreed, errors };
}

/**
 * Perform comprehensive image cleanup
 */
export async function cleanupDockerImages(docker: Docker): Promise<CleanupResult> {
  logger.info('=== Starting Docker Image Cleanup ===');

  // Check disk usage before cleanup
  const diskUsageBefore = await getDockerDiskUsage(docker);
  logger.info(
    `Docker images using ${(diskUsageBefore.usedBytes / 1024 / 1024 / 1024).toFixed(2)} GB`,
  );

  // Remove dangling images first
  const danglingResult = await removeDanglingImages(docker);
  logger.info(
    `Dangling images cleanup: ${danglingResult.count} images removed, ${(danglingResult.bytesFreed / 1024 / 1024).toFixed(2)} MB freed`,
  );

  // Remove old images based on retention policy
  const oldImagesResult = await removeOldImages(docker);
  logger.info(
    `Old images cleanup: ${oldImagesResult.count} images removed, ${(oldImagesResult.bytesFreed / 1024 / 1024).toFixed(2)} MB freed`,
  );

  // Check disk usage after cleanup
  const diskUsageAfter = await getDockerDiskUsage(docker);
  const totalBytesFreed = diskUsageBefore.usedBytes - diskUsageAfter.usedBytes;

  logger.info(
    `Total cleanup: ${danglingResult.count + oldImagesResult.count} images removed, ${(totalBytesFreed / 1024 / 1024).toFixed(2)} MB freed`,
  );

  const allErrors = [...danglingResult.errors, ...oldImagesResult.errors];
  if (allErrors.length > 0) {
    logger.error(`Cleanup completed with ${allErrors.length} errors`);
  }

  // Log warning if disk usage is still high
  if (diskUsageAfter.usedPercent > DISK_USAGE_THRESHOLD_PERCENT) {
    logger.warn(
      `⚠️  Disk usage (${diskUsageAfter.usedPercent.toFixed(1)}%) still exceeds threshold (${DISK_USAGE_THRESHOLD_PERCENT}%)`,
    );
  }

  logger.info('=== Docker Image Cleanup Complete ===');

  return {
    danglingImagesRemoved: danglingResult.count,
    oldImagesRemoved: oldImagesResult.count,
    bytesFreed: totalBytesFreed,
    errors: allErrors,
  };
}
