import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { prisma } from 'database';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import fastifyWebsocket from '@fastify/websocket';
import dotenv from 'dotenv';

dotenv.config();

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Separate connection for subscriptions
const subConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

const deploymentQueue = new Queue('deployments', {
  connection: redisConnection,
});

const fastify = Fastify({
  logger: true,
});

fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});

fastify.register(fastifyWebsocket);

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'secret',
});

// Routes
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Auth Routes (Simplified for MVP)
fastify.post('/auth/github', async (request, reply) => {
  // In a real app, we would exchange code for token
  // For MVP, we'll assume the frontend sends user info after GitHub OAuth
  const { githubId, username, avatarUrl } = request.body as any;

  let user = await prisma.user.findUnique({ where: { githubId } });
  if (!user) {
    user = await prisma.user.create({
      data: { githubId, username, avatarUrl },
    });
  }

  const token = fastify.jwt.sign({ id: user.id, username: user.username });
  return { token, user };
});

// Service Routes
fastify.get('/services', async (request) => {
  // Add authentication middleware in real app
  return prisma.service.findMany({
    include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
});

fastify.patch('/services/:id', async (request, reply) => {
  const { id } = request.params as any;
  const { name, repoUrl, branch, buildCommand, startCommand, port, envVars } = request.body as any;

  const service = await prisma.service.update({
    where: { id },
    data: {
      name,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port: port ? parseInt(port) : undefined,
      envVars,
    },
  });

  return service;
});

fastify.post('/services', async (request, reply) => {
  const { name, repoUrl, branch, buildCommand, startCommand, userId, port } = request.body as any;

  // Ensure user exists for MVP/Mock purposes
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: userId,
        githubId: `github-${userId}`,
        username: 'mock-user',
      }
    });
  }

  const service = await prisma.service.upsert({
    where: { name },
    update: {
      repoUrl,
      branch: branch || 'main',
      buildCommand,
      startCommand,
      port: port ? parseInt(port) : 3000,
      userId,
    },
    create: {
      name,
      repoUrl,
      branch: branch || 'main',
      buildCommand,
      startCommand,
      port: port ? parseInt(port) : 3000,
      userId,
    },
  });

  return service;
});

fastify.delete('/services/:id', async (request, reply) => {
  const { id } = request.params as any;

  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  // 1. Stop and remove containers if they exist
  const Docker = (await import('dockerode')).default;
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });
  const serviceContainers = containers.filter(c => c.Labels['helvetia.serviceId'] === id);

  for (const containerInfo of serviceContainers) {
    const container = docker.getContainer(containerInfo.Id);
    await container.stop().catch(() => { });
    await container.remove().catch(() => { });
  }

  // 2. Delete deployments and service from DB
  await prisma.deployment.deleteMany({ where: { serviceId: id } });
  await prisma.service.delete({ where: { id } });

  return { success: true };
});

fastify.get('/services/:id/health', async (request, reply) => {
  const { id } = request.params as any;
  const Docker = (await import('dockerode')).default;
  const docker = new Docker();

  const containers = await docker.listContainers({ all: true });
  const serviceContainers = containers.filter(c => c.Labels['helvetia.serviceId'] === id);

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
});

// Deployment Routes
fastify.post('/services/:id/deploy', async (request, reply) => {
  const { id } = request.params as any;

  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  const deployment = await prisma.deployment.create({
    data: {
      serviceId: id,
      status: 'QUEUED',
    },
  });

  await deploymentQueue.add('build', {
    deploymentId: deployment.id,
    serviceId: service.id,
    repoUrl: service.repoUrl,
    branch: service.branch,
    buildCommand: service.buildCommand,
    startCommand: service.startCommand,
    serviceName: service.name,
    port: service.port,
    envVars: service.envVars,
  });

  return deployment;
});

fastify.post('/webhooks/github', async (request, reply) => {
  const payload = request.body as any;

  // Basic check for push event
  if (!payload.repository || !payload.ref) {
    return { skipped: 'Not a push event' };
  }

  const repoUrl = payload.repository.html_url;
  const branch = payload.ref.replace('refs/heads/', '');

  console.log(`Received GitHub webhook for ${repoUrl} on branch ${branch}`);

  // Find service(s) matching this repo and branch
  const services = await prisma.service.findMany({
    where: {
      repoUrl: { contains: repoUrl }, // Use contains to handle .git suffix variations
      branch,
    },
  });

  if (services.length === 0) {
    console.log(`No service found for ${repoUrl} on branch ${branch}`);
    return { skipped: 'No matching service found' };
  }

  for (const service of services) {
    console.log(`Triggering automated deployment for ${service.name}`);

    const deployment = await prisma.deployment.create({
      data: {
        serviceId: service.id,
        status: 'QUEUED',
        commitHash: payload.after,
      },
    });

    await deploymentQueue.add('build', {
      deploymentId: deployment.id,
      serviceId: service.id,
      repoUrl: service.repoUrl,
      branch: service.branch,
      buildCommand: service.buildCommand,
      startCommand: service.startCommand,
      serviceName: service.name,
      port: service.port,
      envVars: service.envVars,
    });
  }

  return { success: true, servicesTriggered: services.length };
});

fastify.get('/services/:id/deployments', async (request, reply) => {
  const { id } = request.params as any;
  return prisma.deployment.findMany({
    where: { serviceId: id },
    orderBy: { createdAt: 'desc' },
  });
});

fastify.get('/deployments/:id/logs', async (request, reply) => {
  const { id } = request.params as any;
  const deployment = await prisma.deployment.findUnique({ where: { id } });
  return { logs: deployment?.logs };
});

fastify.get('/deployments/:id/logs/stream', { websocket: true }, (connection, req) => {
  const { id } = req.params as any;
  const channel = `deployment-logs:${id}`;

  console.log(`Client connected for live logs: ${id}`);

  const onMessage = (chan: string, message: string) => {
    if (chan === channel) {
      connection.socket.send(message);
    }
  };

  subConnection.subscribe(channel);
  subConnection.on('message', onMessage);

  connection.socket.on('close', () => {
    console.log(`Client disconnected from live logs: ${id}`);
    // We shouldn't unsubscribe from the channel globally if other clients are listening
    // But for MVP, simple is fine. Actually, ioredis handles multiple subscribers on the same connection.
    // However, we only have one subConnection. Let's just remove the listener.
    subConnection.removeListener('message', onMessage);
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
