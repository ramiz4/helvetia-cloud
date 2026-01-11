/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import type { IDeploymentRepository, IServiceRepository, IUserRepository } from '../interfaces';
import { getRepoUrlMatchCondition } from '../utils/repoUrl';

/**
 * WebhookController
 * Handles GitHub webhook events (Push and Pull Request)
 * Thin controller layer that delegates to repositories and utility functions
 */
@injectable()
export class WebhookController {
  constructor(
    @inject(Symbol.for('IServiceRepository'))
    private serviceRepository: IServiceRepository,
    @inject(Symbol.for('IDeploymentRepository'))
    private deploymentRepository: IDeploymentRepository,
    @inject(Symbol.for('IUserRepository'))
    private userRepository: IUserRepository,
    @inject('DeploymentQueue')
    private deploymentQueue: any,
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
    } catch (error) {
      console.error('Error verifying GitHub signature:', error);
      return false;
    }
  }

  /**
   * Helper to create and queue deployment
   */
  private async createAndQueueDeployment(service: any, commitHash: string): Promise<any> {
    const deployment = await this.deploymentRepository.create({
      serviceId: service.id,
      status: 'QUEUED',
      commitHash: commitHash,
    });

    // Inject token if available
    let repoUrlData = service.repoUrl;
    const dbUser = await this.userRepository.findById(service.userId);
    if (dbUser?.githubAccessToken && repoUrlData && repoUrlData.includes('github.com')) {
      const { decrypt } = await import('../utils/crypto');
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
      customDomain: (service as any).customDomain,
      type: (service as any).type,
      staticOutputDir: (service as any).staticOutputDir,
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
      console.log(`Stopping and removing container ${containerInfo.Id} for service ${id}`);
      await container.stop().catch(() => {});
      await container.remove().catch(() => {});
    }

    // Clean up associated volumes for database services
    const serviceType = (service as any).type;
    if (serviceType && ['POSTGRES', 'REDIS', 'MYSQL'].includes(serviceType)) {
      const volumeName = `helvetia-data-${service.name}`;
      try {
        const volume = docker.getVolume(volumeName);
        await volume.remove();
        console.log(`Removed volume ${volumeName} for service ${service.name}`);
      } catch (err) {
        if ((err as any).statusCode !== 404) {
          console.error(`Failed to remove volume ${volumeName}:`, err);
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
          console.log(`Removed volume ${volumeInfo.Name} for compose project ${service.name}`);
        }
      } catch (err) {
        console.error(`Failed to list/remove volumes for compose project ${service.name}:`, err);
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
        console.log(`Removed image ${tag}`);
      } catch (err) {
        // Don't log error if image doesn't exist
        if ((err as any).statusCode !== 404) {
          console.error(`Failed to remove image ${tag}:`, err);
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
  async handleGitHubWebhook(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    // Verify GitHub webhook signature
    const signature = request.headers['x-hub-signature-256'] as string;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('GITHUB_WEBHOOK_SECRET is not configured');
      return reply.status(500).send({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      console.warn('GitHub webhook received without signature', {
        ip: request.ip,
        headers: request.headers,
      });
      return reply.status(401).send({ error: 'Missing signature' });
    }

    // Get raw body for signature verification
    const rawBody = (request as any).rawBody;

    if (!rawBody) {
      console.warn('GitHub webhook received without raw body');
      return reply.status(400).send({ error: 'Missing raw body' });
    }

    if (!this.verifyGitHubSignature(rawBody, signature, webhookSecret)) {
      console.warn('GitHub webhook signature verification failed', {
        ip: request.ip,
        signature: signature.substring(0, 20) + '...',
      });
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    const payload = request.body as any;

    if (payload?._isMalformed) {
      return reply.status(400).send({ error: 'Invalid JSON payload', message: payload._error });
    }

    // Handle Pull Request events
    if (payload.pull_request) {
      return this.handlePullRequestEvent(payload, reply);
    }

    // Handle Push events
    return this.handlePushEvent(payload, reply);
  }

  /**
   * Handle GitHub Pull Request events
   */
  private async handlePullRequestEvent(payload: any, reply: FastifyReply): Promise<any> {
    try {
      const pr = payload.pull_request;
      const action = payload.action;
      const prNumber = payload.number;
      const repoUrl = pr.base.repo.html_url;
      const headBranch = pr.head.ref;

      console.log(`Received GitHub PR webhook: PR #${prNumber} ${action} on ${repoUrl}`);

      if (['opened', 'synchronize'].includes(action)) {
        // Find the base service for this repo (the one that isn't a preview)
        const { prisma } = await import('database');
        const baseService = await prisma.service.findFirst({
          where: {
            ...getRepoUrlMatchCondition(repoUrl),
            isPreview: false,
            deletedAt: null,
          },
        });

        if (!baseService) {
          console.log(`No base service found for ${repoUrl}, skipping preview deployment`);
          return reply.status(200).send({ skipped: 'No base service found' });
        }

        const previewName = `${baseService.name}-pr-${prNumber}`;

        // Upsert the preview service
        const service = await prisma.service.upsert({
          where: { name: previewName },
          update: {
            branch: headBranch,
            status: 'IDLE',
          },
          create: {
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
            isPreview: true,
            prNumber: prNumber,
          },
        });

        console.log(`Triggering preview deployment for ${service.name}`);

        await this.createAndQueueDeployment(service, pr.head.sha);

        return reply.status(200).send({ success: true, previewService: service.name });
      }

      if (action === 'closed') {
        const { prisma } = await import('database');
        const previewService = await prisma.service.findFirst({
          where: {
            prNumber: prNumber,
            ...getRepoUrlMatchCondition(repoUrl),
            isPreview: true,
            deletedAt: null,
          },
        });

        if (previewService) {
          console.log(`Cleaning up preview environment for PR #${prNumber}`);
          await this.deleteService(previewService.id, previewService.userId);
          return reply.status(200).send({ success: true, deletedService: previewService.name });
        }
        return reply.status(200).send({ skipped: 'No preview service found to delete' });
      }

      return reply.status(200).send({ skipped: `Action ${action} not handled` });
    } catch (error: any) {
      console.error('Error handling GitHub PR webhook:', error.message);
      return reply.status(500).send({
        error: 'Internal server error while processing webhook',
        message: error.message,
      });
    }
  }

  /**
   * Handle GitHub Push events
   */
  private async handlePushEvent(payload: any, reply: FastifyReply): Promise<any> {
    // Basic check for push event
    if (!payload.repository || !payload.ref) {
      return reply.status(200).send({ skipped: 'Not a push or PR event' });
    }

    const repoUrl = payload.repository.html_url;
    const branch = payload.ref.replace('refs/heads/', '');

    console.log(`Received GitHub push webhook for ${repoUrl} on branch ${branch}`);

    // Find service(s) matching this repo and branch
    const { prisma } = await import('database');
    const services = await prisma.service.findMany({
      where: {
        ...getRepoUrlMatchCondition(repoUrl),
        branch,
        isPreview: false, // Only trigger non-preview services for push events
        deletedAt: null,
      },
    });

    if (services.length === 0) {
      console.log(`No service found for ${repoUrl} on branch ${branch}`);
      return reply.status(200).send({ skipped: 'No matching service found' });
    }

    try {
      for (const service of services) {
        console.log(`Triggering automated deployment for ${service.name}`);
        await this.createAndQueueDeployment(service, payload.after);
      }
      return reply.status(200).send({ success: true, servicesTriggered: services.length });
    } catch (error: any) {
      console.error('Error handling GitHub push webhook:', error.message);
      return reply.status(500).send({
        error: 'Internal server error while processing webhook',
        message: error.message,
      });
    }
  }
}
