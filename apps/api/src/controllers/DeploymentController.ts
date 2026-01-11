import '../types/fastify';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { CONTAINER_CPU_NANOCPUS, CONTAINER_MEMORY_LIMIT_BYTES } from '../config/constants';
import { ForbiddenError, NotFoundError } from '../errors';
import type { IDeploymentRepository, IServiceRepository } from '../interfaces';
import { DeploymentOrchestratorService } from '../services';
import { getSafeOrigin } from '../utils/helpers/cors.helper';
import { getDefaultPortForServiceType } from '../utils/helpers/service.helper';
import { withStatusLock } from '../utils/statusLock';
import { validateToken } from '../utils/tokenValidation';

/**
 * DeploymentController
 * Handles all deployment-related HTTP endpoints
 * Thin controller layer that delegates to DeploymentOrchestratorService and repositories
 */
@injectable()
export class DeploymentController {
  constructor(
    @inject(Symbol.for('DeploymentOrchestratorService'))
    private deploymentService: DeploymentOrchestratorService,
    @inject(Symbol.for('IServiceRepository'))
    private serviceRepository: IServiceRepository,
    @inject(Symbol.for('IDeploymentRepository'))
    private deploymentRepository: IDeploymentRepository,
  ) {}

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
      const deployment = await this.deploymentService.createAndQueueDeployment(id, user.id);

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

    const { prisma } = await import('database');
    const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
    if (!service) {
      return reply.status(404).send({ error: 'Service not found' });
    }

    if (service.type === 'COMPOSE') {
      return reply.status(400).send({
        error:
          'Please use "Redeploy" for Docker Compose services to apply environment variables and configuration changes correctly.',
      });
    }

    const Docker = (await import('dockerode')).default;
    const docker = new Docker();

    try {
      // Find existing containers for this service
      const containers = await docker.listContainers({ all: true });
      const serviceContainers = containers.filter((c) => c.Labels['helvetia.serviceId'] === id);

      if (serviceContainers.length === 0) {
        return reply
          .status(404)
          .send({ error: 'No running container found. Please deploy first.' });
      }

      // Get the image tag from the first container
      const existingContainer = docker.getContainer(serviceContainers[0].Id);
      const containerInfo = await existingContainer.inspect();
      const imageTag = containerInfo.Config.Image;

      // Generate a new container name
      const postfix = Math.random().toString(36).substring(2, 8);
      const containerName = `${service.name}-${postfix}`;

      const traefikRule = service.customDomain
        ? `Host(\`${service.name}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${service.name}.localhost\`) || Host(\`${service.customDomain}\`)`
        : `Host(\`${service.name}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${service.name}.localhost\`)`;

      // Create new container with updated config
      const newContainer = await docker.createContainer({
        Image: imageTag,
        name: containerName,
        Env: service.envVars ? Object.entries(service.envVars).map(([k, v]) => `${k}=${v}`) : [],
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
          'helvetia.type': service.type || 'DOCKER',
          'traefik.enable': 'true',
          [`traefik.http.routers.${service.name}.rule`]: traefikRule,
          [`traefik.http.routers.${service.name}.entrypoints`]: 'web',
          [`traefik.http.services.${service.name}.loadbalancer.server.port`]: (
            service.port || getDefaultPortForServiceType(service.type || 'DOCKER')
          ).toString(),
        },
        HostConfig: {
          NetworkMode: 'helvetia-net',
          RestartPolicy: { Name: 'always' },
          Memory: CONTAINER_MEMORY_LIMIT_BYTES,
          NanoCpus: CONTAINER_CPU_NANOCPUS,
          Binds:
            service.type === 'POSTGRES'
              ? [`helvetia-data-${service.name}:/var/lib/postgresql/data`]
              : service.type === 'REDIS'
                ? [`helvetia-data-${service.name}:/data`]
                : service.type === 'MYSQL'
                  ? [`helvetia-data-${service.name}:/var/lib/mysql`]
                  : [],
          LogConfig: {
            Type: 'json-file',
            Config: {},
          },
        },
      });

      await newContainer.start();

      // Stop and remove old containers
      for (const old of serviceContainers) {
        const container = docker.getContainer(old.Id);
        await container.stop().catch(() => {});
        await container.remove().catch(() => {});
      }

      return { success: true, message: 'Container restarted successfully' };
    } catch (error) {
      console.error('Restart error:', error);
      return reply.status(500).send({ error: 'Failed to restart container' });
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
  async streamDeploymentLogs(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const { id } = request.params as any;
    const user = (request as any).user;

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

    console.log(`SSE client connected for live logs: ${id}`);

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

    // Get Redis connection from fastify instance
    const subConnection = (request.server as any).redis;
    const channel = `deployment-logs:${id}`;

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

      // Clean up Redis subscription
      if (isSubscribed) {
        try {
          subConnection.removeListener('message', onMessage);
          await subConnection.unsubscribe(channel);
          isSubscribed = false;
        } catch (err) {
          console.error(`Error unsubscribing from channel ${channel}:`, err);
        }
      }

      console.log(
        `SSE logs connection cleaned up for deployment ${id}. ` +
          `Duration: ${Date.now() - connectionState.startTime}ms, ` +
          `Messages: ${connectionState.messagesReceived}, ` +
          `Validations: ${connectionState.validationAttempts}, ` +
          `Errors: ${connectionState.errorCount}`,
      );
    };

    const onMessage = (chan: string, message: string) => {
      if (!connectionState.isValid) return;
      if (chan === channel) {
        try {
          // Send log line as an SSE event
          reply.raw.write(`data: ${message}\n\n`);
          connectionState.messagesReceived++;
        } catch (err) {
          connectionState.errorCount++;
          console.error(`Error writing log message for deployment ${id}:`, err);

          // If write fails, connection is likely broken
          if (connectionState.errorCount >= 3) {
            console.error(`Too many write errors for deployment ${id}, closing connection`);
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
          console.log(`Token expired for user ${user.id}, closing logs stream`);
          // Send error event to client
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            console.error('Error writing token expiration message:', writeErr);
          }
          await cleanup();
        }
      } catch (err) {
        connectionState.errorCount++;
        console.error(`Error during token validation for deployment ${id}:`, err);

        // If validation fails repeatedly, close connection
        if (connectionState.errorCount >= 3) {
          console.error(`Too many validation errors for deployment ${id}, closing connection`);
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            console.error('Error writing error message:', writeErr);
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
      console.error(`Error subscribing to channel ${channel}:`, err);
      return reply.status(500).send({ error: 'Failed to establish log stream' });
    }

    // Implement connection timeout (60 minutes for logs)
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
    const LOGS_CONNECTION_TIMEOUT_MS = 60 * 60 * 1000;
    timeoutHandle = setTimeout(
      async () => {
        console.log(`SSE logs connection timeout for deployment ${id}`);
        try {
          reply.raw.write(
            `event: error\ndata: ${JSON.stringify({ error: 'Connection timeout', code: 'TIMEOUT' })}\n\n`,
          );
          reply.raw.end();
        } catch (err) {
          console.error('Error writing timeout message:', err);
        }
        await cleanup();
      },
      isTestEnv ? 100 : LOGS_CONNECTION_TIMEOUT_MS,
    );

    // Clean up on client disconnect
    request.raw.on('close', async () => {
      console.log(`SSE client disconnected from live logs: ${id}`);
      await cleanup();
    });

    // Clean up on error
    request.raw.on('error', async (err) => {
      console.error(`SSE logs connection error for deployment ${id}:`, err);
      await cleanup();
    });

    reply.raw.on('error', async (err) => {
      console.error(`SSE logs reply error for deployment ${id}:`, err);
      await cleanup();
    });

    // Keep the connection open
    return reply;
  }
}
