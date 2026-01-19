import '../types/fastify.js';

import type { Queue } from 'bullmq';
import crypto from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens.js';
import type {
  IDeploymentRepository,
  ILogger,
  IServiceRepository,
  IUserRepository,
} from '../interfaces/index.js';
import { getRepoUrlMatchCondition } from '../utils/repoUrl.js';

interface PullRequestEvent {
  action: string;
  number: number;
  pull_request: {
    number: number;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      repo: {
        html_url: string;
      };
    };
  };
}

interface PushEvent {
  ref: string;
  repository: {
    clone_url: string;
    full_name: string;
    html_url: string;
  };
  after: string;
}

interface ServiceData {
  id: string;
  userId: string;
  repoUrl?: string | null;
  branch?: string | null;
  buildCommand?: string | null;
  startCommand?: string | null;
  name: string;
  port?: number | null;
  envVars?: unknown;
  customDomain?: string | null;
  type: string;
  staticOutputDir?: string | null;
}

/**
 * WebhookController
 * Handles GitHub webhook events (Push and Pull Request)
 * Thin controller layer that delegates to repositories and utility functions
 */
@injectable()
export class WebhookController {
  constructor(
    @inject(TOKENS.ServiceRepository)
    private serviceRepository: IServiceRepository,
    @inject(TOKENS.DeploymentRepository)
    private deploymentRepository: IDeploymentRepository,
    @inject(TOKENS.UserRepository)
    private userRepository: IUserRepository,
    @inject(TOKENS.DeploymentQueue)
    private deploymentQueue: Queue,
    @inject(TOKENS.Logger)
    private logger: ILogger,
  ) {}

  /**
   * Verify GitHub webhook signature
   * Ensures the webhook request came from GitHub
   */
  private verifyGitHubSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    if (!signature || !secret) {
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(payload).digest('hex');

      const signatureBuffer = Buffer.from(signature);
      const digestBuffer = Buffer.from(digest);
      if (signatureBuffer.length !== digestBuffer.length) {
        return false;
      }
      // Use timingSafeEqual to prevent timing attacks
      return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
    } catch {
      // Caller should log this with request context if possible
      return false;
    }
  }

  /**
   * Helper to create and queue deployment
   */
  private async createAndQueueDeployment(
    service: ServiceData,
    commitHash: string,
    requestId?: string,
  ): Promise<unknown> {
    const deployment = await this.deploymentRepository.create({
      serviceId: service.id,
      status: 'QUEUED',
      commitHash: commitHash,
    });

    // Inject token if available
    let repoUrlData = service.repoUrl;
    const dbUser = await this.userRepository.findById(service.userId);
    if (dbUser?.githubAccessToken && repoUrlData && repoUrlData.includes('github.com')) {
      const { decrypt } = await import('../utils/crypto.js');
      const decryptedToken = decrypt(dbUser.githubAccessToken);
      repoUrlData = repoUrlData.replace('https://', `https://${decryptedToken}@`);
    }

    await this.deploymentQueue.add('build', {
      deploymentId: deployment.id,
      serviceId: service.id,
      repoUrl: repoUrlData,
      branch: service.branch,
      buildCommand: service.buildCommand,
      startCommand: service.startCommand,
      serviceName: service.name,
      port: service.port,
      envVars: service.envVars,
      customDomain: service.customDomain,
      type: service.type,
      staticOutputDir: service.staticOutputDir,
      requestId, // Include request ID for tracing
    });

    return deployment;
  }

  /**
   * Helper to delete a service and its resources
   */
  private async deleteService(id: string, userId?: string): Promise<void> {
    const service = await this.serviceRepository.findById(id);
    if (!service) return;

    // Verify ownership if userId is provided
    if (userId && service.userId !== userId) {
      throw new Error('Unauthorized service deletion attempt');
    }

    // 1. Stop and remove containers if they exist
    const Docker = (await import('dockerode')).default;
    const docker = new Docker();
    const containers = await docker.listContainers({ all: true });
    const serviceContainers = containers.filter(
      (c) =>
        c.Labels['helvetia.serviceId'] === id ||
        (service.type === 'COMPOSE' && c.Labels['com.docker.compose.project'] === service.name),
    );

    for (const containerInfo of serviceContainers) {
      const container = docker.getContainer(containerInfo.Id);
      this.logger.info(
        { containerId: containerInfo.Id, serviceId: id },
        'Stopping and removing container for service',
      );
      await container.stop().catch(() => {});
      await container.remove().catch(() => {});
    }

    // Clean up associated volumes for database services
    const serviceType = service.type;
    if (serviceType && ['POSTGRES', 'REDIS', 'MYSQL'].includes(serviceType)) {
      const volumeName = `helvetia-data-${service.name}`;
      try {
        const volume = docker.getVolume(volumeName);
        await volume.remove();
        this.logger.info({ volumeName, serviceName: service.name }, 'Removed volume for service');
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number };
        if (error.statusCode !== 404) {
          this.logger.error({ err, volumeName }, 'Failed to remove volume');
        }
      }
    } else if (serviceType === 'COMPOSE') {
      try {
        const { Volumes } = await docker.listVolumes();
        const projectVolumes = Volumes.filter(
          (v) => v.Labels && v.Labels['com.docker.compose.project'] === service.name,
        );

        for (const volumeInfo of projectVolumes) {
          const volume = docker.getVolume(volumeInfo.Name);
          await volume.remove();
          this.logger.info(
            { volumeName: volumeInfo.Name, projectName: service.name },
            'Removed volume for compose project',
          );
        }
      } catch (err) {
        this.logger.error(
          { err, projectName: service.name },
          'Failed to list/remove volumes for compose project',
        );
      }
    }

    // 1.5 Remove associated images
    const deployments = await this.deploymentRepository.findByServiceId(id);

    const imageTags = new Set(
      deployments.map((d) => d.imageTag).filter((tag): tag is string => !!tag),
    );

    for (const tag of imageTags) {
      try {
        const image = docker.getImage(tag);
        await image.remove({ force: true });
        this.logger.info({ tag }, 'Removed image');
      } catch (err: unknown) {
        const error = err as Error & { statusCode?: number };
        // Don't log error if image doesn't exist
        if (error.statusCode !== 404) {
          this.logger.error({ err, tag }, 'Failed to remove image');
        }
      }
    }

    // 2. Delete deployments and services from DB
    await this.deploymentRepository.deleteByServiceId(id);
    await this.serviceRepository.delete(id);
  }

  /**
   * POST /webhooks/github
   * Handle GitHub webhook events (Push and Pull Request)
   */
  async handleGitHubWebhook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void | FastifyReply> {
    // Verify GitHub webhook signature
    const signature = request.headers['x-hub-signature-256'] as string;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!webhookSecret) {
      this.logger.error('GITHUB_WEBHOOK_SECRET is not configured');
      return reply.status(500).send({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      this.logger.warn(
        {
          ip: request.ip,
          headers: request.headers,
        },
        'GitHub webhook received without signature',
      );
      return reply.status(400).send({ error: 'Missing signature' });
    }

    // Get raw body for signature verification
    const rawBody = request.rawBody;

    if (!rawBody) {
      this.logger.warn('GitHub webhook received without raw body');
      return reply.status(400).send({ error: 'Missing raw body' });
    }

    if (!this.verifyGitHubSignature(rawBody, signature, webhookSecret)) {
      this.logger.warn(
        {
          ip: request.ip,
          signature: signature.substring(0, 20) + '...',
        },
        'GitHub webhook signature verification failed',
      );
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    const payload = request.body as {
      _isMalformed?: boolean;
      _error?: string;
      action?: string;
      pull_request?: {
        merged?: boolean;
        head?: { ref?: string; sha?: string };
        base?: { ref?: string };
      };
      ref?: string;
      after?: string;
      repository?: {
        full_name?: string;
        clone_url?: string;
        html_url?: string;
        ssh_url?: string;
        git_url?: string;
      };
    };

    if (payload?._isMalformed) {
      return reply.status(400).send({ error: 'Invalid JSON payload', message: payload._error });
    }

    // Handle Pull Request events
    if (payload.pull_request) {
      return this.handlePullRequestEvent(payload as PullRequestEvent, reply, request.id);
    }

    // Handle Push events
    return this.handlePushEvent(payload as PushEvent, reply, request.id);
  }

  /**
   * Handle GitHub Pull Request events
   */
  private async handlePullRequestEvent(
    payload: PullRequestEvent,
    reply: FastifyReply,
    requestId?: string,
  ): Promise<void | FastifyReply> {
    try {
      const pr = payload.pull_request;
      const action = payload.action;
      const prNumber = payload.number;
      const repoUrl = pr.base.repo.html_url;
      const headBranch = pr.head.ref;

      this.logger.info({ prNumber, action, repoUrl, requestId }, 'Received GitHub PR webhook');

      if (['opened', 'synchronize'].includes(action)) {
        // Find the base service for this repo (the one that isn't a preview)
        const baseService = await this.serviceRepository.findBaseServiceByRepoUrl(
          getRepoUrlMatchCondition(repoUrl),
        );

        if (!baseService) {
          this.logger.info(
            { repoUrl, requestId },
            'No base service found for PR webhook, skipping preview deployment',
          );
          return reply.status(200).send({ skipped: 'No base service found' });
        }

        const previewName = `${baseService.name}-pr-${prNumber}`;

        // Check if preview service exists
        const existingService = await this.serviceRepository.findByNameAndEnvironment(
          previewName,
          baseService.environmentId || '',
          baseService.userId,
        );

        let service;
        if (existingService) {
          // Update existing preview service
          service = await this.serviceRepository.update(existingService.id, {
            branch: headBranch,
            status: 'IDLE',
          });
        } else {
          // Create new preview service
          service = await this.serviceRepository.create({
            name: previewName,
            repoUrl: baseService.repoUrl,
            branch: headBranch,
            buildCommand: baseService.buildCommand,
            startCommand: baseService.startCommand,
            port: baseService.port,
            type: baseService.type,
            staticOutputDir: baseService.staticOutputDir,
            envVars: baseService.envVars || {},
            userId: baseService.userId,
            environmentId: baseService.environmentId,
            isPreview: true,
            prNumber: prNumber,
          });
        }

        this.logger.info({ serviceName: service.name, requestId }, 'Triggering preview deployment');

        await this.createAndQueueDeployment(service, pr.head.sha, requestId);

        return reply.status(200).send({ success: true, previewService: service.name });
      }

      if (action === 'closed') {
        const previewService = await this.serviceRepository.findPreviewByPrNumberAndRepoUrl(
          prNumber,
          getRepoUrlMatchCondition(repoUrl),
        );

        if (previewService) {
          this.logger.info({ prNumber, requestId }, 'Cleaning up preview environment for PR');
          await this.deleteService(previewService.id, previewService.userId);
          return reply.status(200).send({ success: true, deletedService: previewService.name });
        }
        return reply.status(200).send({ skipped: 'No preview service found to delete' });
      }

      return reply.status(200).send({ skipped: `Action ${action} not handled` });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error({ err, requestId }, 'Error handling GitHub PR webhook');
      return reply.status(500).send({
        error: 'Internal server error while processing webhook',
        message: err.message,
      });
    }
  }

  /**
   * Handle GitHub Push events
   */
  private async handlePushEvent(
    payload: PushEvent,
    reply: FastifyReply,
    requestId?: string,
  ): Promise<void | FastifyReply> {
    // Basic check for push event
    if (!payload.repository || !payload.ref) {
      return reply.status(200).send({ skipped: 'Not a push or PR event' });
    }

    const repoUrl = payload.repository.html_url;
    const branch = payload.ref.replace('refs/heads/', '');

    this.logger.info({ repoUrl, branch, requestId }, 'Received GitHub push webhook');

    // Find service(s) matching this repo and branch
    const services = await this.serviceRepository.findByRepoUrlAndBranch(
      getRepoUrlMatchCondition(repoUrl),
      branch,
    );

    if (services.length === 0) {
      this.logger.info({ repoUrl, branch, requestId }, 'No service found for push webhook');
      return reply.status(200).send({ skipped: 'No matching service found' });
    }

    try {
      for (const service of services) {
        this.logger.info(
          { serviceName: service.name, requestId },
          'Triggering automated deployment',
        );
        await this.createAndQueueDeployment(service, payload.after, requestId);
      }
      return reply.status(200).send({ success: true, servicesTriggered: services.length });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error({ err, requestId }, 'Error handling GitHub push webhook');
      return reply.status(500).send({
        error: 'Internal server error while processing webhook',
        message: err.message,
      });
    }
  }
}
