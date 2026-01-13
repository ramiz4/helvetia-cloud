import { Job, Worker } from 'bullmq';
import { prisma } from 'database';
import Docker from 'dockerode';
import IORedis from 'ioredis';
import { MAX_LOG_SIZE_CHARS } from './config/constants';
import type { DeploymentContext } from './interfaces';
import { workerMetricsService } from './services/metrics.service';
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
    const jobStartTime = Date.now();
    const jobName = job.name || 'build';

    // Track active jobs
    workerMetricsService.incrementActiveJobs(jobName);

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
      username,
      volumes,
      requestId, // Extract request ID from job data for cross-service tracing
    } = job.data;

    let newContainer: Docker.Container | null = null;
    let oldContainers: Docker.ContainerInfo[] = [];
    let imageTag = '';
    let buildLogs = '';
    let containerPostfix = '';
    let deploymentStatus = 'FAILED';
    const serviceType = type || 'DOCKER';

    // Prepare secrets for scrubbing
    const secrets = envVars
      ? (Object.values(envVars).filter((v) => typeof v === 'string' && v.length > 0) as string[])
      : [];
    const scrubLogs = createScrubber(secrets);

    // Log with request ID for correlation
    const logPrefix = requestId ? `[reqId: ${requestId}] ` : '';
    console.log(`${logPrefix}Starting deployment ${deploymentId} for service ${serviceName}`);

    // Verify deployment exists before starting
    const deploymentRecord = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deploymentRecord) {
      console.error(`${logPrefix}Deployment ${deploymentId} not found in database. Skipping job.`);
      return;
    }

    // Validate environment variables before proceeding
    if (envVars && Object.keys(envVars).length > 0) {
      console.log(`${logPrefix}Validating environment variables...`);
      const envValidation = await validateGeneratedDockerfile({
        dockerfileContent: 'FROM scratch', // Dummy dockerfile for env var validation only
        envVars,
      });

      if (!envValidation.valid) {
        const errorMessage = formatValidationErrors(envValidation);
        console.error(`${logPrefix}Environment variable validation failed:`, errorMessage);
        throw new Error(
          `Environment variable validation failed:\n${envValidation.errors.join('\n')}`,
        );
      }

      if (envValidation.warnings.length > 0) {
        console.warn(
          `${logPrefix}Environment variable warnings:`,
          envValidation.warnings.join(', '),
        );
      }

      console.log(`${logPrefix}✅ Environment variables validated successfully`);
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
      console.log(
        `${logPrefix}Found ${oldContainers.length} running containers for rollback if needed`,
      );

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
        githubToken: job.data.githubToken,
        projectName: job.data.projectName,
        environmentName: job.data.environmentName,
        username,
        volumes,
        onLog: (log) => {
          const sanitized = log
            .replace(/\0/g, '')
            // eslint-disable-next-line no-control-regex
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
          const scrubbed = scrubLogs(sanitized);
          publishLogs(redisConnection, deploymentId, scrubbed).catch((err) =>
            console.error('Failed to publish real-time logs:', err),
          );
        },
      };

      // Execute deployment using the appropriate strategy
      const result = await strategy.deploy(context);
      imageTag = result.imageTag;
      buildLogs = result.buildLogs;

      // Sanitize logs for PostgreSQL (remove null bytes and invalid UTF8)
      const sanitizedLogs = buildLogs
        .replace(/\0/g, '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

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
        console.log(`${logPrefix}Deployment ${deploymentId} successful!`);
        return;
      }

      // Check if service is stateful (Database) or has writable volumes
      // If a service has writable volumes, we should use Recreate strategy to avoid
      // two containers trying to write to the same files simultaneously (file locking issues).
      const hasWriteVolumes =
        volumes?.some((v: string) => !v.toLowerCase().endsWith(':ro')) ?? false;
      const isStateful = ['POSTGRES', 'REDIS', 'MYSQL'].includes(type) || hasWriteVolumes;

      if (isStateful) {
        context.onLog?.(
          `Stateful service detected. Stopping old containers before starting new one (Recreate Strategy)...\n`,
        );
        // For stateful services, we must remove the old container first to avoid matching aliases
        // (Round-Robin DNS issue) and to ensure volume locks are released.
        await cleanupOldContainers({
          docker,
          serviceId,
          serviceName,
          // Pass a dummy postfix so it doesn't match any existing container,
          // effectively ensuring ALL old containers for this service are removed.
          currentPostfix: '___recreate_strategy___',
        });
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
        projectName: context.projectName,
        environmentName: context.environmentName,
        username: context.username,
        volumes: volumes,
        onLog: context.onLog,
      });
      newContainer = containerResult.container;
      containerPostfix = containerResult.postfix;

      context.onLog?.(`✅ Container ${containerResult.postfix} started successfully.\n\n`);
      context.onLog?.(`==== Cleaning up old containers ====\n`);

      // Cleanup old containers (Zero-Downtime: Do this AFTER starting the new one)
      // Only for stateless services where we want overlap.
      if (!isStateful) {
        await cleanupOldContainers({
          docker,
          serviceId,
          serviceName,
          currentPostfix: containerPostfix,
        });
      }

      context.onLog?.(`✅ Cleanup complete.\n\n`);
      context.onLog?.(`🚀 Deployment ${deploymentId} successful!\n`);

      // Update deployment and service status
      await updateDeploymentStatus({
        deploymentId,
        serviceId,
        status: 'SUCCESS',
        imageTag,
      });

      deploymentStatus = 'SUCCESS';
      console.log(`${logPrefix}Deployment ${deploymentId} successful!`);
    } catch (error) {
      console.error(`${logPrefix}Deployment ${deploymentId} failed:`, error);

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
        console.log(`${logPrefix}Cleaning up failed new container...`);
        try {
          await newContainer.stop({ t: 5 }).catch(() => {
            console.log(`${logPrefix}Failed to stop new container (may not be running)`);
          });
          await newContainer.remove({ force: true });
          console.log(`${logPrefix}Failed new container removed`);
        } catch (cleanupError) {
          console.error(`${logPrefix}Failed to cleanup new container:`, cleanupError);
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
            `${logPrefix}Service status set to RUNNING after rollback attempt; previous containers may still be serving traffic`,
          );
        }
      } catch (dbError: unknown) {
        // Check if it's a Prisma error safely
        if (
          typeof dbError === 'object' &&
          dbError !== null &&
          'code' in dbError &&
          (dbError as Record<string, unknown>).code === 'P2025'
        ) {
          console.error(
            `${logPrefix}Failed to update database: Deployment ${deploymentId} was deleted during processing.`,
          );
        } else {
          console.error(`${logPrefix}Failed to update database with error status:`, dbError);
        }
      }

      deploymentStatus = 'FAILED';

      // Re-throw to mark job as failed
      throw error;
    } finally {
      // Record metrics for this deployment
      const duration = (Date.now() - jobStartTime) / 1000;
      workerMetricsService.recordDeployment(deploymentStatus, serviceType, duration);
      workerMetricsService.recordJobProcessing(
        jobName,
        deploymentStatus === 'SUCCESS' ? 'completed' : 'failed',
        duration,
      );
      workerMetricsService.decrementActiveJobs(jobName);
    }
  },
  { connection: redisConnection },
);

// Removed auto-start for testing
// console.log('Worker started and listening for jobs...');
