import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { prisma } from 'database';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

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
  const { name, repoUrl, branch, buildCommand, startCommand, port } = request.body as any;

  const service = await prisma.service.update({
    where: { id },
    data: {
      name,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port: port ? parseInt(port) : undefined,
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
  });

  return deployment;
});

fastify.get('/deployments/:id/logs', async (request, reply) => {
  const { id } = request.params as any;
  const deployment = await prisma.deployment.findUnique({ where: { id } });
  return { logs: deployment?.logs };
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
