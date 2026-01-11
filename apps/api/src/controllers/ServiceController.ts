import '../types/fastify';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { ZodError } from 'zod';
import { getServiceMetrics } from '../handlers/metrics.handler';
import type { IDeploymentRepository, IServiceRepository } from '../interfaces';
import { ServiceCreateSchema, ServiceUpdateSchema } from '../schemas/service.schema';
import { getSafeOrigin } from '../utils/helpers/cors.helper';
import { getDefaultPortForServiceType } from '../utils/helpers/service.helper';
import { determineServiceStatus } from '../utils/helpers/status.helper';

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
  ) {}

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
    const Docker = (await import('dockerode')).default;
    const docker = new Docker();
    const containers = await docker.listContainers({ all: true });

    return servicesWithDeployments.map((service) => ({
      ...service,
      status: determineServiceStatus(service, containers),
    }));
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
    const Docker = (await import('dockerode')).default;
    const docker = new Docker();
    const containers = await docker.listContainers({ all: true });

    return {
      ...service,
      deployments,
      status: determineServiceStatus({ ...service, deployments }, containers),
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
          details: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
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
    } = validatedData;

    const finalType = type || 'DOCKER';
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }
    const userId = user.id;

    // Check if another user owns this service name - use raw Prisma for complex query
    const { prisma } = await import('database');
    const existingByName = await prisma.service.findFirst({
      where: { name, userId: { not: userId }, deletedAt: null },
    });
    if (existingByName) {
      return reply.status(403).send({ error: 'Service name taken by another user' });
    }

    let finalPort = port || 3000;
    let finalEnvVars = envVars || {};

    if (finalType === 'STATIC') finalPort = 80;
    if (finalType === 'POSTGRES') {
      finalPort = 5444;
      // Generate default credentials if not provided
      if (!finalEnvVars.POSTGRES_PASSWORD) {
        const crypto = await import('crypto');
        finalEnvVars = {
          ...finalEnvVars,
          POSTGRES_USER: 'postgres',
          POSTGRES_PASSWORD: crypto.default.randomBytes(16).toString('hex'),
          POSTGRES_DB: 'app',
        };
      }
    }
    if (finalType === 'REDIS') {
      finalPort = 6379;
      // Generate default Redis password if not provided
      if (!finalEnvVars.REDIS_PASSWORD) {
        const crypto = await import('crypto');
        finalEnvVars = {
          ...finalEnvVars,
          REDIS_PASSWORD: crypto.default.randomBytes(16).toString('hex'),
        };
      }
    }
    if (finalType === 'MYSQL') {
      finalPort = 3306;
      if (!finalEnvVars.MYSQL_ROOT_PASSWORD) {
        const crypto = await import('crypto');
        finalEnvVars = {
          ...finalEnvVars,
          MYSQL_ROOT_PASSWORD: crypto.default.randomBytes(16).toString('hex'),
          MYSQL_DATABASE: 'app',
        };
      }
    }

    // Check if service exists
    const existing = await this.serviceRepository.findByNameAndUserId(name, userId);

    if (existing) {
      // Update existing service
      return this.serviceRepository.update(existing.id, {
        repoUrl,
        branch: branch || 'main',
        buildCommand,
        startCommand,
        port: finalPort,
        customDomain,
        type: finalType,
        staticOutputDir: staticOutputDir || 'dist',
        envVars: finalEnvVars,
        deletedAt: null, // Resurrect service if it was soft-deleted
      });
    } else {
      // Create new service
      return this.serviceRepository.create({
        name,
        repoUrl: repoUrl || null,
        branch: branch || 'main',
        buildCommand,
        startCommand,
        port: finalPort,
        userId,
        customDomain,
        type: finalType,
        staticOutputDir: staticOutputDir || 'dist',
        envVars: finalEnvVars,
      });
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
          details: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
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
    const updatedService = await this.serviceRepository.update(id, {
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
    });

    const deployments = await this.deploymentRepository.findByServiceId(id, { take: 1 });
    return { ...updatedService, deployments };
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

    const service = await this.serviceRepository.findById(id);
    if (!service || service.userId !== user.id || service.deletedAt) {
      return reply.status(404).send({ error: 'Service not found or unauthorized' });
    }

    // Check if service is protected from deletion
    if (service.deleteProtected) {
      return reply
        .status(403)
        .send({ error: 'Service is protected from deletion. Remove protection first.' });
    }

    // Perform soft deletion
    await this.serviceRepository.update(id, { deletedAt: new Date() });

    return { success: true, message: 'Service soft deleted. Can be recovered within 30 days.' };
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
    const { deleteProtected } = request.body as { deleteProtected?: boolean };

    if (typeof deleteProtected !== 'boolean') {
      return reply.status(400).send({ error: 'deleteProtected must be a boolean' });
    }

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

    const { prisma } = await import('database');
    const service = await prisma.service.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });
    if (!service) return reply.status(404).send({ error: 'Service not found' });

    const Docker = (await import('dockerode')).default;
    const docker = new Docker();

    const containers = await docker.listContainers({ all: true });
    const serviceContainers = containers.filter((c) => c.Labels['helvetia.serviceId'] === id);

    if (serviceContainers.length === 0) {
      return { status: 'NOT_RUNNING' };
    }

    const containerInfo = serviceContainers[0]; // Take the latest one
    const container = docker.getContainer(containerInfo.Id);
    const data = await container.inspect();

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

    const { prisma } = await import('database');
    const service = await prisma.service.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });
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

    // Set SSE headers with CORS support
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': getSafeOrigin(request.headers.origin),
      'Access-Control-Allow-Credentials': 'true',
    });

    console.log(`SSE client connected for real-time metrics: ${user.id}`);

    // Import helper function for token validation
    const { validateToken } = await import('../utils/tokenValidation.js');
    const { prisma } = await import('database');
    const { METRICS_UPDATE_INTERVAL_MS, CONNECTION_TIMEOUT_MS } =
      await import('../config/constants.js');

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

      console.log(
        `SSE metrics connection cleaned up for user ${user.id}. ` +
          `Duration: ${Date.now() - connectionState.startTime}ms, ` +
          `Metrics sent: ${connectionState.metricsCount}, ` +
          `Errors: ${connectionState.errorCount}`,
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
          console.log(`Token expired for user ${user.id}, closing metrics stream`);
          // Send error event to client
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            console.error('Error writing token expiration message:', writeErr);
          }
          cleanup();
          return;
        }

        const Docker = (await import('dockerode')).default;
        const docker = new Docker();
        const containers = await docker.listContainers({ all: true });

        const services = await prisma.service.findMany({
          where: { userId: user.id, deletedAt: null },
          select: { id: true, name: true, type: true, status: true },
        });

        const metricsPromises = services.map(async (s) => ({
          id: s.id,
          metrics: await getServiceMetrics(s.id, docker, containers, s),
        }));

        const results = await Promise.all(metricsPromises);

        // Check if still valid before writing
        if (!connectionState.isValid) {
          cleanup();
          return;
        }

        // Send it as an SSE event
        reply.raw.write(`data: ${JSON.stringify(results)}\n\n`);
        connectionState.metricsCount++;
      } catch (err) {
        connectionState.errorCount++;
        console.error(`Error sending metrics via SSE (user ${user.id}):`, err);

        // If too many consecutive errors, close the connection
        if (connectionState.errorCount >= 3) {
          console.error(`Too many errors for user ${user.id}, closing connection`);
          try {
            reply.raw.write(
              `event: error\ndata: ${JSON.stringify({ error: 'Internal server error', code: 'SERVER_ERROR' })}\n\n`,
            );
            reply.raw.end();
          } catch (writeErr) {
            console.error('Error writing error message:', writeErr);
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
        console.log(`SSE metrics connection timeout for user ${user.id}`);
        try {
          reply.raw.write(
            `event: error\ndata: ${JSON.stringify({ error: 'Connection timeout', code: 'TIMEOUT' })}\n\n`,
          );
          reply.raw.end();
        } catch (err) {
          console.error('Error writing timeout message:', err);
        }
        cleanup();
      },
      isTestEnv ? 100 : CONNECTION_TIMEOUT_MS,
    );

    // Clean up on client disconnect
    request.raw.on('close', () => {
      console.log(`SSE client disconnected from real-time metrics: ${user.id}`);
      cleanup();
    });

    // Clean up on error
    request.raw.on('error', (err) => {
      console.error(`SSE metrics connection error for user ${user.id}:`, err);
      cleanup();
    });

    reply.raw.on('error', (err) => {
      console.error(`SSE metrics reply error for user ${user.id}:`, err);
      cleanup();
    });

    // Keep the connection open
    return reply;
  }
}
