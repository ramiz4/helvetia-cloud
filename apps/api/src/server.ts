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

fastify.register(cors);
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

fastify.post('/services', async (request, reply) => {
  const { name, repoUrl, branch, buildCommand, startCommand, userId } = request.body as any;

  const service = await prisma.service.create({
    data: {
      name,
      repoUrl,
      branch: branch || 'main',
      buildCommand,
      startCommand,
      userId,
    },
  });

  return service;
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
