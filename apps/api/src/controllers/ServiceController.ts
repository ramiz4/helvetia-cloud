import type Docker from 'dockerode';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { ZodError } from 'zod';
import { CONNECTION_TIMEOUT_MS, METRICS_UPDATE_INTERVAL_MS } from '../config/constants';
import { ForbiddenError, NotFoundError } from '../errors';
import { getServiceMetrics } from '../handlers/metrics.handler';
import type {
  IContainerOrchestrator,
  IDeploymentRepository,
  IServiceManagementService,
  IServiceRepository,
} from '../interfaces';
import {
  ProtectionToggleSchema,
  ServiceCreateSchema,
  ServiceUpdateSchema,
} from '../schemas/service.schema';
import '../types/fastify';
import { formatZodError } from '../utils/errorFormatting';
import { getSafeOrigin } from '../utils/helpers/cors.helper';
import { getDefaultPortForServiceType } from '../utils/helpers/service.helper';
import { determineServiceStatus } from '../utils/helpers/status.helper';
import { validateToken } from '../utils/tokenValidation';

/**
 * Type alias for container orchestrator with Docker instance access
 */
type IContainerOrchestratorWithDocker = IContainerOrchestrator & {
  getDockerInstance: () => Docker;
};

/**
 * ServiceController
 * Handles all service-related HTTP endpoints
 * Thin controller layer that delegates to repositories and utility functions
 */
@injectable()
export class ServiceController {
  constructor(
    @inject(Symbol.for('IServiceRepository'))
    private serviceRepository: IServiceRepository,
    @inject(Symbol.for('IDeploymentRepository'))
    private deploymentRepository: IDeploymentRepository,
    @inject(Symbol.for('ServiceManagementService'))
    private serviceManagement: IServiceManagementService,
    @inject(Symbol.for('IContainerOrchestrator'))
    private containerOrchestrator: IContainerOrchestrator,
  ) {}

  /**
   * Get Docker instance from container orchestrator or return undefined
   * This is needed for metrics collection which requires direct Docker API access
   */
  private getDockerInstance(): Docker | undefined {
    if ('getDockerInstance' in this.containerOrchestrator) {
      return (this.containerOrchestrator as IContainerOrchestratorWithDocker).getDockerInstance();
    }
    return undefined;
  }

  /**
   * GET /services
   * List all services for the authenticated user
   */
  async getAllServices(request: FastifyRequest) {
    const user = request.user;
    if (!user) {
      throw new Error('User not authenticated');
    }
    const services = await this.serviceRepository.findByUserId(user.id);

    // Fetch latest deployment for each service
    const servicesWithDeployments = await Promise.all(
      services.map(async (service) => {
        const deployments = await this.deploymentRepository.findByServiceId(service.id, {
          take: 1,
        });
        return {
          ...service,
          deployments,
        };
      }),
    );

    // Enrich services with actual Docker container status
    const containers = await this.containerOrchestrator.listContainers({ all: true });

    return servicesWithDeployments.map((service) => {
      const serviceContainers = containers.filter(
        (c) => c.labels['helvetia.serviceId'] === service.id,
      );
      const containerName = serviceContainers[0]?.name;

      return {
        ...service,
        projectName: service.environment?.project?.name,
        environmentName: service.environment?.name,
        username: user.username,
        status: determineServiceStatus(service, containers),
        containerName,
      };
    });
  }

  /**
   * GET /services/:id
   * Get a specific service by ID
   */
  async getServiceById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const service = await this.serviceRepository.findById(id);
    if (!service || service.userId !== user.id || service.deletedAt) {
      return reply.status(404).send({ error: 'Service not found' });
    }

    const deployments = await this.deploymentRepository.findByServiceId(service.id, { take: 1 });

    // Enrich service with actual Docker container status
    const containers = await this.containerOrchestrator.listContainers({ all: true });

    const serviceContainers = containers.filter(
      (c) => c.labels['helvetia.serviceId'] === service.id,
    );
    const containerName = serviceContainers[0]?.name;

    return {
      ...service,
      deployments,
      projectName: service.environment?.project?.name,
      environmentName: service.environment?.name,
      username: user.username,
      status: determineServiceStatus({ ...service, deployments }, containers),
      containerName,
    };
  }

  /**
   * POST /services
   * Create a new service
   */
  async createService(request: FastifyRequest, reply: FastifyReply) {
    // Validate and parse request body
    let validatedData;
    try {
      validatedData = ServiceCreateSchema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatZodError(error),
        });
      }
      throw error;
    }

    const {
      name,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port,
      customDomain,
      type,
      staticOutputDir,
      envVars,
      volumes,
      // Helper fields for COMPOSE
      composeFile,
      mainService,
      environmentId,
    } = validatedData;

    let finalBuildCommand = buildCommand;
    let finalStartCommand = startCommand;

    // For COMPOSE type, map helper fields to command fields if provided
    if (type?.toUpperCase() === 'COMPOSE') {
      if (composeFile) finalBuildCommand = composeFile;
      if (mainService) finalStartCommand = mainService;
    }

    const finalType = type || 'DOCKER';
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }
    const userId = user.id;

    // Delegate to ServiceManagementService
    try {
      return await this.serviceManagement.createOrUpdateService({
        name,
        userId,
        environmentId,
        repoUrl: repoUrl || undefined,
        branch: branch || undefined,
        buildCommand: finalBuildCommand,
        startCommand: finalStartCommand,
        port,
        customDomain: customDomain || undefined,
        type: finalType,
        staticOutputDir: staticOutputDir || undefined,
        envVars,
        volumes,
      });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return reply.status(403).send({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * PATCH /services/:id
   * Update an existing service
   */
  async updateService(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    // Validate and parse request body
    let validatedData;
    try {
      validatedData = ServiceUpdateSchema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatZodError(error),
        });
      }
      throw error;
    }

    const {
      name,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port,
      envVars,
      customDomain,
      type,
      staticOutputDir,
      environmentId,
      volumes,
    } = validatedData;

    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // First verify the service exists and user owns it
    const existingService = await this.serviceRepository.findById(id);
    if (!existingService || existingService.userId !== user.id) {
      return reply.status(404).send({ error: 'Service not found or unauthorized' });
    }

    // Update the service
    await this.serviceRepository.update(id, {
      name,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port: port ?? (type ? getDefaultPortForServiceType(type) : undefined),
      envVars,
      customDomain,
      type: type,
      staticOutputDir,
      environmentId,
      volumes,
    });

    // Fetch the updated service with relations
    const fullService = await this.serviceRepository.findById(id);
    if (!fullService) {
      throw new Error('Service not found after update');
    }

    const deployments = await this.deploymentRepository.findByServiceId(id, { take: 1 });

    // Enrich with actual Docker container status
    const containers = await this.containerOrchestrator.listContainers({ all: true });

    const serviceContainers = containers.filter((c) => c.labels['helvetia.serviceId'] === id);
    const containerName = serviceContainers[0]?.name;

    return {
      ...fullService,
      deployments,
      projectName: fullService.environment?.project?.name,
      environmentName: fullService.environment?.name,
      username: user.username,
      status: determineServiceStatus({ ...fullService, deployments }, containers),
      containerName,
    };
  }

  /**
   * DELETE /services/:id
   * Soft delete a service
   */
  async deleteService(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Delegate to ServiceManagementService
    try {
      await this.serviceManagement.softDeleteService(id, user.id);
      return {
        success: true,
        message: 'Service soft deleted. Can be recovered within 30 days.',
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      if (error instanceof ForbiddenError) {
        return reply.status(403).send({ error: error.message });
      }
      throw error;
    }
  }

  /**
   * POST /services/:id/recover
   * Recover a soft-deleted service
   */
  async recoverService(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const service = await this.serviceRepository.findById(id);

    if (!service || service.userId !== user.id || !service.deletedAt) {
      return reply.status(404).send({ error: 'Deleted service not found or unauthorized' });
    }

    // Restore the service
    const restored = await this.serviceRepository.update(id, { deletedAt: null });

    return { success: true, service: restored, message: 'Service recovered successfully' };
  }

  /**
   * PATCH /services/:id/protection
   * Toggle delete protection for a service
   */
  async toggleProtection(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Validate and parse request body
    let validatedData;
    try {
      validatedData = ProtectionToggleSchema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatZodError(error),
        });
      }
      throw error;
    }

    const { deleteProtected } = validatedData;

    const service = await this.serviceRepository.findById(id);

    if (!service || service.userId !== user.id || service.deletedAt) {
      return reply.status(404).send({ error: 'Service not found or unauthorized' });
    }

    const updated = await this.serviceRepository.update(id, { deleteProtected });

    return { success: true, service: updated };
  }

  /**
   * GET /services/:id/health
   * Get health status of a service
   */
  async getServiceHealth(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const service = await this.serviceRepository.findByIdAndUserId(id, user.id);
    if (!service) return reply.status(404).send({ error: 'Service not found' });

    const containers = await this.containerOrchestrator.listContainers({ all: true });
    const serviceContainers = containers.filter((c) => c.labels['helvetia.serviceId'] === id);

    if (serviceContainers.length === 0) {
      return { status: 'NOT_RUNNING' };
    }

    const containerInfo = serviceContainers[0]; // Take the latest one
    const container = await this.containerOrchestrator.getContainer(containerInfo.id);
    const data = await this.containerOrchestrator.inspectContainer(container);

    return {
      status: data.State.Running ? 'RUNNING' : 'STOPPED',
      health: data.State.Health?.Status || 'UNKNOWN',
      startedAt: data.State.StartedAt,
      exitCode: data.State.ExitCode,
    };
  }

  /**
   * GET /services/:id/metrics
   * Get metrics for a specific service
   */
  async getServiceMetrics(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    const service = await this.serviceRepository.findByIdAndUserId(id, user.id);
    if (!service) return reply.status(404).send({ error: 'Service not found' });

    return getServiceMetrics(id, undefined, undefined, service);
  }

  /**
   * GET /services/metrics/stream
   * Server-Sent Events endpoint for real-time metrics streaming
   */
  async streamMetrics(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }
    try {
      // Set SSE headers with CORS support
      const origin = getSafeOrigin(request.headers.origin);
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      });

      request.log.info({ userId: user.id }, 'SSE client connected for real-time metrics');

      // Track connection state for better observability
      const connectionState = {
        isValid: true,
        startTime: Date.now(),
        metricsCount: 0,
        errorCount: 0,
      };

      // Store interval reference for cleanup
      let metricsInterval: NodeJS.Timeout | null = null;
      let timeoutHandle: NodeJS.Timeout | null = null;

      // Cleanup function to ensure all resources are freed
      const cleanup = () => {
        if (!connectionState.isValid) return; // Already cleaned up

        connectionState.isValid = false;

        if (metricsInterval) {
          clearInterval(metricsInterval);
          metricsInterval = null;
        }

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        request.log.info(
          {
            userId: user.id,
            duration: Date.now() - connectionState.startTime,
            metricsSent: connectionState.metricsCount,
            errorCount: connectionState.errorCount,
          },
          'SSE metrics connection cleaned up',
        );
      };

      const sendMetrics = async () => {
        // Check connection validity before proceeding
        if (!connectionState.isValid) {
          cleanup();
          return;
        }

        try {
          // Validate token before sending metrics
          const isValid = await validateToken(request);
          if (!isValid) {
            request.log.info({ userId: user.id }, 'Token expired, closing metrics stream');
            // Send error event to client
            try {
              reply.raw.write(
                `event: error\ndata: ${JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' })}\n\n`,
              );
              reply.raw.end();
            } catch (writeErr) {
              request.log.error({ err: writeErr }, 'Error writing token expiration message');
            }
            cleanup();
            return;
          }

          const services = await this.serviceRepository.findByUserId(user.id);

          // Get the underlying Docker instance for metrics collection
          // getServiceMetrics still needs direct Docker access for stats API
          const docker = this.getDockerInstance();

          // Fetch containers once and pass to all metrics calls for better performance
          let containerList: Docker.ContainerInfo[];
          if (docker) {
            containerList = await docker.listContainers({ all: true });
          }

          const metricsPromises = services.map(async (s) => ({
            id: s.id,
            metrics: await getServiceMetrics(s.id, docker, containerList, s),
          }));

          const results = await Promise.all(metricsPromises);

          // Check if still valid before writing
          if (!connectionState.isValid) {
            cleanup();
            return;
          }

          reply.raw.write(`data: ${JSON.stringify(results)}\n\n`);
          connectionState.metricsCount++;
        } catch (err) {
          connectionState.errorCount++;
          request.log.error({ err, userId: user.id }, 'Error sending metrics via SSE');

          // If too many consecutive errors, close the connection
          if (connectionState.errorCount >= 3) {
            request.log.warn(
              { userId: user.id },
              'Too many errors for metrics SSE, closing connection',
            );
            try {
              reply.raw.write(
                `event: error\ndata: ${JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' })}\n\n`,
              );
              reply.raw.end();
            } catch (writeErr) {
              request.log.error({ err: writeErr }, 'Error writing error message');
            }
            cleanup();
          }
        }
      };

      // Send immediate connection acknowledgment (makes it feel instant)
      reply.raw.write(': connected\n\n');

      // Fetch and send initial metrics asynchronously (non-blocking)
      await sendMetrics();

      // Set up periodic metrics updates
      metricsInterval = setInterval(async () => {
        if (!connectionState.isValid) {
          cleanup();
          return;
        }
        await sendMetrics();
      }, METRICS_UPDATE_INTERVAL_MS);

      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;

      // Implement connection timeout
      timeoutHandle = setTimeout(
        () => {
          request.log.info({ userId: user.id }, 'SSE metrics connection timeout');
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Connection timeout', code: 'TIMEOUT' })}\n\n`,
            );
            reply.raw.end();
          } catch (err) {
            request.log.error({ err }, 'Error writing timeout message');
          }
          cleanup();
        },
        isTestEnv ? 100 : CONNECTION_TIMEOUT_MS,
      );

      // Clean up on client disconnect
      request.raw.on('close', () => {
        request.log.info({ userId: user.id }, 'SSE client disconnected from real-time metrics');
        cleanup();
      });

      // Clean up on error
      request.raw.on('error', (err) => {
        request.log.error({ err, userId: user.id }, 'SSE metrics connection error');
        cleanup();
      });

      reply.raw.on('error', (err) => {
        request.log.error({ err, userId: user.id }, 'SSE metrics reply error');
        cleanup();
      });

      return reply;
    } catch (err) {
      request.log.error({ err, userId: user.id }, 'Error initializing SSE metrics stream');
      if (!reply.raw.headersSent) {
        return reply.status(500).send({ error: 'Failed to initialize metrics stream' });
      }
      return reply;
    }
  }
}
