import { Job, Worker } from 'bullmq';
import { prisma } from 'database';
import Docker from 'dockerode';
import IORedis from 'ioredis';
import { MAX_LOG_SIZE_CHARS } from './config/constants';
import type { DeploymentContext } from './interfaces';
import { DeploymentStrategyFactory } from './strategies';
import {
  cleanupOldContainers,
  publishLogs,
  rollbackContainers,
  startContainer,
  updateDeploymentStatus,
} from './utils/containerHelpers';
import { formatValidationErrors, validateGeneratedDockerfile } from './utils/dockerfile-validator';
import { createScrubber } from './utils/logs';

const docker = new Docker();
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Initialize strategy factory
const strategyFactory = new DeploymentStrategyFactory();

export const worker = new Worker(
  'deployments',
  async (job: Job) => {
    const {
      deploymentId,
      serviceId,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      serviceName,
      port,
      envVars,
      customDomain,
      type,
      staticOutputDir,
    } = job.data;

    let newContainer: Docker.Container | null = null;
    let oldContainers: Docker.ContainerInfo[] = [];
    let imageTag = '';
    let buildLogs = '';
    let containerPostfix = '';

    // Prepare secrets for scrubbing
    const secrets = envVars
      ? (Object.values(envVars).filter((v) => typeof v === 'string' && v.length > 0) as string[])
      : [];
    const scrubLogs = createScrubber(secrets);

    console.log(`Starting deployment ${deploymentId} for service ${serviceName}`);

    // Validate environment variables before proceeding
    if (envVars && Object.keys(envVars).length > 0) {
      console.log('Validating environment variables...');
      const envValidation = await validateGeneratedDockerfile({
        dockerfileContent: 'FROM scratch', // Dummy dockerfile for env var validation only
        envVars,
      });

      if (!envValidation.valid) {
        const errorMessage = formatValidationErrors(envValidation);
        console.error('Environment variable validation failed:', errorMessage);
        throw new Error(
          `Environment variable validation failed:\n${envValidation.errors.join('\n')}`,
        );
      }

      if (envValidation.warnings.length > 0) {
        console.warn('Environment variable warnings:', envValidation.warnings.join(', '));
      }

      console.log('✅ Environment variables validated successfully');
    }

    try {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'BUILDING' },
      });

      // Capture old containers before deployment for potential rollback
      const allContainers = await docker.listContainers({ all: true });
      oldContainers = allContainers.filter(
        (c) => c.Labels['helvetia.serviceId'] === serviceId && c.State === 'running',
      );
      console.log(`Found ${oldContainers.length} running containers for rollback if needed`);

      // Use strategy pattern to handle deployment based on type
      const strategy = strategyFactory.getStrategy(type);
      const context: DeploymentContext = {
        job,
        docker,
        deploymentId,
        serviceId,
        serviceName,
        repoUrl,
        branch,
        buildCommand,
        startCommand,
        port,
        envVars,
        customDomain,
        staticOutputDir,
        type,
      };

      // Execute deployment using the appropriate strategy
      const result = await strategy.deploy(context);
      imageTag = result.imageTag;
      buildLogs = result.buildLogs;

      // Sanitize logs for PostgreSQL (remove null bytes and invalid UTF8)
      /* eslint-disable no-control-regex */
      const sanitizedLogs = buildLogs
        .replace(/\0/g, '')
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
      /* eslint-enable no-control-regex */

      // Scrub sensitive data from logs
      const scrubbedLogs = scrubLogs(sanitizedLogs);

      // Publish logs to Redis for real-time streaming
      await publishLogs(redisConnection, deploymentId, scrubbedLogs);

      // Update logs in DB
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { logs: scrubbedLogs },
      });

      // For COMPOSE deployments, we don't need to start individual containers
      // The compose strategy handles container orchestration itself
      if (type === 'COMPOSE') {
        await updateDeploymentStatus({
          deploymentId,
          serviceId,
          status: 'SUCCESS',
          logs: scrubbedLogs,
        });
        console.log(`Deployment ${deploymentId} successful!`);
        return;
      }

      // Start new container
      const containerResult = await startContainer({
        docker,
        imageTag,
        serviceName,
        serviceId,
        type,
        port,
        envVars,
        customDomain,
      });
      newContainer = containerResult.container;
      containerPostfix = containerResult.postfix;

      // Cleanup old containers (Zero-Downtime: Do this AFTER starting the new one)
      await cleanupOldContainers({
        docker,
        serviceId,
        serviceName,
        currentPostfix: containerPostfix,
      });

      // Update deployment and service status
      await updateDeploymentStatus({
        deploymentId,
        serviceId,
        status: 'SUCCESS',
        imageTag,
      });

      console.log(`Deployment ${deploymentId} successful!`);
    } catch (error) {
      console.error(`Deployment ${deploymentId} failed:`, error);

      // Comprehensive error logging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      const fullErrorLog = [
        '=== DEPLOYMENT FAILURE ===',
        `Error: ${errorMessage}`,
        errorStack ? `Stack Trace:\n${errorStack}` : '',
        buildLogs ? `\n=== BUILD LOGS ===\n${buildLogs}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      console.error('Full error details:', fullErrorLog);

      // Cleanup: Remove failed new container if it was created
      if (newContainer) {
        console.log('Cleaning up failed new container...');
        try {
          await newContainer.stop({ t: 5 }).catch(() => {
            console.log('Failed to stop new container (may not be running)');
          });
          await newContainer.remove({ force: true });
          console.log('Failed new container removed');
        } catch (cleanupError) {
          console.error('Failed to cleanup new container:', cleanupError);
        }
      }

      // Rollback: Restart old containers if they exist
      await rollbackContainers({ docker, oldContainers });

      // Update database with detailed error information
      try {
        await updateDeploymentStatus({
          deploymentId,
          serviceId,
          status: 'FAILED',
          logs: fullErrorLog.substring(0, MAX_LOG_SIZE_CHARS),
          oldContainers,
        });

        if (oldContainers.length > 0) {
          console.log(
            'Service status set to RUNNING after rollback attempt; previous containers may still be serving traffic',
          );
        }
      } catch (dbError) {
        console.error('Failed to update database with error status:', dbError);
      }

      // Re-throw to mark job as failed
      throw error;
    }
  },
  { connection: redisConnection },
);

// Removed auto-start for testing
// console.log('Worker started and listening for jobs...');
