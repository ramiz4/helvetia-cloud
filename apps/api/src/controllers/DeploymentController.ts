import '../types/fastify';

import type Docker from 'dockerode';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PLATFORM_DOMAIN, withStatusLock } from 'shared';
import { inject, injectable } from 'tsyringe';
import { CONTAINER_CPU_NANOCPUS, CONTAINER_MEMORY_LIMIT_BYTES } from '../config/constants';
import { ForbiddenError, NotFoundError } from '../errors';
import type {
  IContainerOrchestrator,
  IDeploymentOrchestratorService,
  IDeploymentRepository,
  IServiceRepository,
} from '../interfaces';
import { getSafeOrigin } from '../utils/helpers/cors.helper';
import { getDefaultPortForServiceType } from '../utils/helpers/service.helper';
import { validateToken } from '../utils/tokenValidation';

/**
 * Type alias for container orchestrator with Docker instance access
 */
type IContainerOrchestratorWithDocker = IContainerOrchestrator & {
  getDockerInstance: () => Docker;
};

/**
 * DeploymentController
 * Handles all deployment-related HTTP endpoints
 * Thin controller layer that delegates to DeploymentOrchestratorService and repositories
 */
@injectable()
export class DeploymentController {
  constructor(
    @inject(Symbol.for('DeploymentOrchestratorService'))
    private deploymentService: IDeploymentOrchestratorService,
    @inject(Symbol.for('IServiceRepository'))
    private serviceRepository: IServiceRepository,
    @inject(Symbol.for('IDeploymentRepository'))
    private deploymentRepository: IDeploymentRepository,
    @inject(Symbol.for('IContainerOrchestrator'))
    private containerOrchestrator: IContainerOrchestrator,
  ) {}

  /**
   * Get Docker instance from container orchestrator or create a new one
   * This is needed for operations that require direct Docker API access
   */
  private async getDockerInstance(): Promise<Docker> {
    if ('getDockerInstance' in this.containerOrchestrator) {
      return (this.containerOrchestrator as IContainerOrchestratorWithDocker).getDockerInstance();
    }
    const DockerLib = (await import('dockerode')).default;
    return new DockerLib();
  }

  /**
   * POST /services/:id/deploy
   * Trigger a new deployment for a service
   */
  async deployService(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Create deployment (this includes service existence and ownership validation)
      // Pass undefined for commitHash (will use latest) and request.id for tracing
      const deployment = await this.deploymentService.createAndQueueDeployment(
        id,
        user.id,
        undefined,
        request.id, // Pass request ID for tracing
      );

      // Update service status to DEPLOYING with distributed lock
      // This is done after validation to avoid updating non-existent services
      await withStatusLock(id, async () => {
        await this.serviceRepository.update(id, { status: 'DEPLOYING' });
      });

      return deployment;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      if (error instanceof ForbiddenError) {
        // Should not happen anymore, but keep for safety
        return reply.status(404).send({ error: 'Service not found' });
      }
      throw error;
    }
  }

  /**
   * POST /services/:id/restart
   * Restart a service container without rebuilding
   */
  async restartService(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const service = await this.serviceRepository.findByIdAndUserIdWithEnvironment(id, user.id);
    if (!service) {
      return reply.status(404).send({ error: 'Service not found' });
    }

    if (service.type === 'COMPOSE') {
      return reply.status(400).send({
        error:
          'Please use "Redeploy" for Docker Compose services to apply environment variables and configuration changes correctly.',
      });
    }

    // Get underlying Docker instance for container management operations
    const docker = await this.getDockerInstance();

    try {
      // Find existing containers for this service
      const containers = await this.containerOrchestrator.listContainers({ all: true });
      const serviceContainers = containers.filter((c) => c.labels['helvetia.serviceId'] === id);

      if (serviceContainers.length === 0) {
        return reply
          .status(404)
          .send({ error: 'No running container found. Please deploy first.' });
      }

      // Get the image tag from the first container
      const existingContainer = docker.getContainer(serviceContainers[0].id);
      const containerInfo = await existingContainer.inspect();
      const imageTag = containerInfo.Config.Image;

      // Naming convention for uniqueness across users and environments
      const sanitizedUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const projectName = service.environment?.project?.name;
      const environmentName = service.environment?.name;

      let baseName = `${sanitizedUsername}-${service.name}`;
      if (projectName && environmentName) {
        baseName = `${sanitizedUsername}-${projectName}-${environmentName}-${service.name}`;
      } else if (projectName) {
        baseName = `${sanitizedUsername}-${projectName}-${service.name}`;
      }

      // Traefik needs a unique identifier for routers and services
      const traefikIdentifier = baseName;

      // Generate a new container name with postfix
      const postfix = Math.random().toString(36).substring(2, 8);
      const containerName = `${baseName}-${postfix}`;

      const traefikRule = service.customDomain
        ? `Host(\`${service.name}.${PLATFORM_DOMAIN}\`) || Host(\`${service.name}.localhost\`) || Host(\`${service.customDomain}\`)`
        : `Host(\`${service.name}.${PLATFORM_DOMAIN}\`) || Host(\`${service.name}.localhost\`)`;

      // Create new container with updated config
      const newContainer = await docker.createContainer({
        Image: imageTag,
        name: containerName,
        Env: service.envVars
          ? Object.entries(service.envVars as Record<string, string>).map(([k, v]) => `${k}=${v}`)
          : [],
        Cmd:
          service.type === 'REDIS' &&
          (service.envVars as Record<string, string> | undefined)?.REDIS_PASSWORD
            ? [
                'redis-server',
                '--requirepass',
                (service.envVars as Record<string, string>).REDIS_PASSWORD,
              ]
            : undefined,
        Labels: {
          'helvetia.serviceId': service.id,
          'helvetia.projectName': projectName || 'global',
          'helvetia.environmentName': environmentName || 'global',
          'helvetia.type': service.type || 'DOCKER',
          'traefik.enable': 'true',
          [`traefik.http.routers.${traefikIdentifier}.rule`]: traefikRule,
          [`traefik.http.routers.${traefikIdentifier}.entrypoints`]: 'web',
          [`traefik.http.services.${traefikIdentifier}.loadbalancer.server.port`]: (
            service.port || getDefaultPortForServiceType(service.type || 'DOCKER')
          ).toString(),
        },
        HostConfig: {
          NetworkMode: 'helvetia-net',
          RestartPolicy: { Name: 'always' },
          Memory: CONTAINER_MEMORY_LIMIT_BYTES,
          NanoCpus: CONTAINER_CPU_NANOCPUS,
          Binds: [
            ...(service.type === 'POSTGRES'
              ? [`helvetia-data-${service.name}:/var/lib/postgresql/data`]
              : service.type === 'REDIS'
                ? [`helvetia-data-${service.name}:/data`]
                : service.type === 'MYSQL'
                  ? [`helvetia-data-${service.name}:/var/lib/mysql`]
                  : []),
            ...((service.volumes as string[] | undefined) || []),
          ],
          LogConfig: {
            Type: 'json-file',
            Config: {},
          },
        },
      });

      await newContainer.start();

      // Stop and remove old containers
      for (const old of serviceContainers) {
        const container = docker.getContainer(old.id);
        await container.stop().catch(() => {});
        await container.remove().catch(() => {});
      }

      return { success: true, message: 'Container restarted successfully', containerName };
    } catch (error) {
      request.log.error(
        { err: error, serviceId: id, userId: user.id },
        'Failed to restart container',
      );
      return reply.status(500).send({ error: 'Failed to restart container' });
    }
  }

  /**
   * POST /services/:id/stop
   * Stop a running service container
   */
  async stopService(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const service = await this.serviceRepository.findByIdAndUserId(id, user.id);
    if (!service) {
      return reply.status(404).send({ error: 'Service not found' });
    }

    // Get underlying Docker instance for container management operations
    const docker = await this.getDockerInstance();

    try {
      // Find existing containers for this service
      const containers = await this.containerOrchestrator.listContainers({ all: true });
      const serviceContainers = containers.filter((c) => c.labels['helvetia.serviceId'] === id);

      if (serviceContainers.length === 0) {
        return reply.status(400).send({ error: 'Service is not running' });
      }

      await Promise.all(
        serviceContainers.map(async (c) => {
          const container = docker.getContainer(c.id);
          if (c.state === 'running') {
            await container.stop();
          }
        }),
      );

      // Update service status (optional, but good for UI responsiveness)
      await withStatusLock(id, async () => {
        await this.serviceRepository.update(id, { status: 'STOPPED' });
      });

      return { success: true, message: 'Service stopped successfully' };
    } catch (error) {
      request.log.error({ err: error, serviceId: id, userId: user.id }, 'Failed to stop service');
      return reply.status(500).send({ error: 'Failed to stop service' });
    }
  }

  /**
   * GET /services/:id/deployments
   * Get all deployments for a service
   */
  async getServiceDeployments(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const deployments = await this.deploymentService.getServiceDeployments(id, user.id);
      return deployments;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      if (error instanceof ForbiddenError) {
        // Should not happen anymore, but keep for safety
        return reply.status(404).send({ error: 'Service not found' });
      }
      throw error;
    }
  }

  /**
   * GET /deployments/:id/logs
   * Get logs for a specific deployment
   */
  async getDeploymentLogs(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      const deployment = await this.deploymentService.getDeployment(id, user.id);
      return { logs: deployment.logs };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      if (error instanceof ForbiddenError) {
        return reply.status(404).send({ error: 'Deployment not found or unauthorized' });
      }
      throw error;
    }
  }

  /**
   * GET /deployments/:id/logs/stream
   * SSE endpoint for real-time deployment logs
   */
  async streamDeploymentLogs(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void | FastifyReply> {
    const { id } = request.params as { id: string };
    const user = request.user;

    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // Verify deployment belongs to user
      await this.deploymentService.getDeployment(id, user.id);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) {
        return reply.status(404).send({ error: 'Deployment not found or unauthorized' });
      }
      throw error;
    }

    // Set SSE headers with CORS support
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': getSafeOrigin(request.headers.origin),
      'Access-Control-Allow-Credentials': 'true',
    });

    request.log.info({ deploymentId: id, userId: user.id }, 'SSE client connected for live logs');

    // Track connection state for better observability
    const connectionState = {
      isValid: true,
      startTime: Date.now(),
      messagesReceived: 0,
      validationAttempts: 0,
      errorCount: 0,
    };

    // Store interval references for cleanup
    let tokenValidationInterval: NodeJS.Timeout | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let isSubscribed = false;
    let subConnection: ReturnType<typeof request.server.redis.duplicate> | null = null;

    // Create dedicated Redis connection for pub/sub to ensure proper cleanup
    // Using shared connections for pub/sub can cause issues with subscription management
    try {
      subConnection = request.server.redis.duplicate();
    } catch (err) {
      request.log.error(
        { err, deploymentId: id },
        'Error creating dedicated Redis connection for deployment logs',
      );
      return reply.status(500).send({ error: 'Failed to establish log stream' });
    }

    const channel = `deployment-logs:${id}`;

    // Track connection health
    let connectionHealthy = true;
    subConnection.on('error', (err) => {
      connectionHealthy = false;
      request.log.error(
        { err, deploymentId: id },
        'Redis subscription connection error for deployment logs',
      );
    });

    // Cleanup function to ensure all resources are freed
    const cleanup = async () => {
      if (!connectionState.isValid) return; // Already cleaned up

      connectionState.isValid = false;

      if (tokenValidationInterval) {
        clearInterval(tokenValidationInterval);
        tokenValidationInterval = null;
      }

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      // Clean up Redis subscription and dedicated connection
      if (subConnection) {
        try {
          if (isSubscribed) {
            subConnection.removeListener('message', onMessage);
            await subConnection.unsubscribe(channel);
            isSubscribed = false;
          }
          // Always quit the connection if it was created
          await subConnection.quit();
        } catch (err) {
          console.error(`Error cleaning up Redis subscription for deployment ${id}:`, err);
        }
      }

      request.log.info(
        {
          deploymentId: id,
          duration: Date.now() - connectionState.startTime,
          messagesReceived: connectionState.messagesReceived,
          validationAttempts: connectionState.validationAttempts,
          errorCount: connectionState.errorCount,
          connectionHealthy,
        },
        'SSE logs connection cleaned up',
      );
    };

    const onMessage = (chan: string, message: string) => {
      if (!connectionState.isValid) return;
      if (chan === channel) {
        try {
          // Send log line as an SSE event, handling multi-line messages to preserve newlines.
          // Note: EventSource strips the last trailing newline from the data buffer per spec,
          // so we add an extra one if the message ends with a newline to preserve it.
          const messageWithExtraLF = message.endsWith('\n') ? message + '\n' : message;
          const formatted = messageWithExtraLF.replace(/\n/g, '\ndata: ');
          reply.raw.write(`data: ${formatted}\n\n`);
          connectionState.messagesReceived++;
        } catch (err) {
          connectionState.errorCount++;
          request.log.error({ err, deploymentId: id }, 'Error writing log message via SSE');

          // If write fails, connection is likely broken
          if (connectionState.errorCount >= 3) {
            request.log.warn(
              { deploymentId: id },
              'Too many write errors for deployment logs SSE, closing connection',
            );
            void cleanup();
          }
        }
      }
    };

    // Set up periodic token validation (every 30 seconds)
    tokenValidationInterval = setInterval(async () => {
      if (!connectionState.isValid) {
        await cleanup();
        return;
      }

      try {
        connectionState.validationAttempts++;
        const isValid = await validateToken(request);
        if (!isValid) {
          request.log.info({ userId: user.id }, 'Token expired, closing logs stream');
          // Send error event to client
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            request.log.error({ err: writeErr }, 'Error writing token expiration message');
          }
          await cleanup();
        }
      } catch (err) {
        connectionState.errorCount++;
        request.log.error(
          { err, deploymentId: id },
          'Error during token validation for deployment',
        );

        // If validation fails repeatedly, close connection
        if (connectionState.errorCount >= 3) {
          request.log.warn(
            { deploymentId: id },
            'Too many validation errors for deployment logs SSE, closing connection',
          );
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            request.log.error({ err: writeErr }, 'Error writing error message');
          }
          await cleanup();
        }
      }
    }, 30000); // Check every 30 seconds

    // Subscribe to Redis channel for logs
    try {
      await subConnection.subscribe(channel);
      isSubscribed = true;
      subConnection.on('message', onMessage);
    } catch (err) {
      request.log.error({ err, channel }, 'Error subscribing to deployment logs channel');
      return reply.status(500).send({ error: 'Failed to establish log stream' });
    }

    // Implement connection timeout (60 minutes for logs)
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
    const LOGS_CONNECTION_TIMEOUT_MS = 60 * 60 * 1000;
    timeoutHandle = setTimeout(
      async () => {
        request.log.info({ deploymentId: id }, 'SSE logs connection timeout');
        try {
          reply.raw.write(
            `event: error\ndata: ${JSON.stringify({ error: 'Connection timeout', code: 'TIMEOUT' })}\n\n`,
          );
          reply.raw.end();
        } catch (err) {
          request.log.error({ err }, 'Error writing timeout message');
        }
        await cleanup();
      },
      isTestEnv ? 100 : LOGS_CONNECTION_TIMEOUT_MS,
    );

    // Clean up on client disconnect
    request.raw.on('close', async () => {
      request.log.info({ deploymentId: id }, 'SSE client disconnected from live logs');
      await cleanup();
    });

    // Clean up on error
    request.raw.on('error', async (err) => {
      request.log.error({ err, deploymentId: id }, 'SSE logs connection error');
      await cleanup();
    });

    reply.raw.on('error', async (err) => {
      request.log.error({ err, deploymentId: id }, 'SSE logs reply error');
      await cleanup();
    });

    // Keep the connection open
    return reply;
  }
}
