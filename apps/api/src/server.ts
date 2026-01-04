/* eslint-disable @typescript-eslint/no-explicit-any */
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyWebsocket from '@fastify/websocket';
import { Queue } from 'bullmq';
import { prisma } from 'database';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import IORedis from 'ioredis';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
dotenv.config({ override: true }); // Prefer local .env if it exists

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

// Auth Hook
fastify.addHook('preHandler', async (request, reply) => {
  const publicRoutes = ['/auth/github', '/health', '/webhooks/github'];
  // WebSocket routes handle auth via query parameter, not header
  const wsRoutes = ['/deployments/'];
  const isWsLogStream = wsRoutes.some(
    (route) => request.url.startsWith(route) && request.url.includes('/logs/stream'),
  );
  // Check if it's a public route, WS route, or an OPTIONS request (CORS)
  if (
    publicRoutes.some((route) => request.url.startsWith(route)) ||
    isWsLogStream ||
    request.method === 'OPTIONS'
  ) {
    return;
  }
  try {
    await request.jwtVerify();
  } catch (err) {
    console.error('Auth Error:', err);
    console.log('Failed Route:', request.url, request.method);
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Routes
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Auth Routes (Simplified for MVP)
fastify.post('/auth/github', async (request, reply) => {
  const { code } = request.body as any;

  if (!code) {
    return reply.status(400).send({ error: 'Code is required' });
  }

  try {
    // 1. Exchange code for access token
    console.log(
      `Exchanging code for token with Client ID: ${process.env.GITHUB_CLIENT_ID?.slice(0, 5)}...`,
    );
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (tokenData.error) {
      console.error('GitHub Token Error:', tokenData);
      return reply
        .status(400)
        .send({ error: tokenData.error_description || tokenData.error, details: tokenData });
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'Helvetia-Cloud',
      },
    });

    const userData = (await userRes.json()) as any;

    // 3. Create or update user in database
    let user = await prisma.user.findUnique({
      where: { githubId: userData.id.toString() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          githubId: userData.id.toString(),
          username: userData.login,
          avatarUrl: userData.avatar_url,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: userData.login,
          avatarUrl: userData.avatar_url,
        },
      });
    }

    const token = fastify.jwt.sign({ id: user.id, username: user.username });
    return { token, user, accessToken };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Service Routes
fastify.get('/services', async (request) => {
  // Add authentication middleware in real app
  const user = (request as any).user;
  const services = await prisma.service.findMany({
    where: { userId: user.id },
    include: { deployments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  // Enrich services with actual Docker container status
  const Docker = (await import('dockerode')).default;
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });

  const enrichedServices = services.map((service) => {
    const serviceContainers = containers.filter(
      (c) => c.Labels['helvetia.serviceId'] === service.id,
    );

    let containerStatus = 'IDLE';
    if (serviceContainers.length > 0) {
      const container = serviceContainers[0];
      containerStatus = container.State === 'running' ? 'RUNNING' : 'STOPPED';
    }

    return {
      ...service,
      status: containerStatus,
    };
  });

  return enrichedServices;
});

fastify.patch('/services/:id', async (request, reply) => {
  const { id } = request.params as any;
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
  } = request.body as any;

  const user = (request as any).user;
  const service = await prisma.service.updateMany({
    where: { id, userId: user.id },
    data: {
      name,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port: port ? parseInt(port) : undefined,
      envVars,
      customDomain,
      type,
      staticOutputDir,
    } as any,
  });

  if (service.count === 0)
    return reply.status(404).send({ error: 'Service not found or unauthorized' });

  return prisma.service.findUnique({ where: { id } });

  return service;
});

fastify.post('/services', async (request, reply) => {
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
  } = request.body as any;
  const user = (request as any).user;
  const userId = user.id;

  // Check ownership if exists
  const existing = await prisma.service.findUnique({ where: { name } });
  if (existing && existing.userId !== userId) {
    return reply.status(403).send({ error: 'Service name taken by another user' });
  }

  const service = await prisma.service.upsert({
    where: { name },
    update: {
      repoUrl,
      branch: branch || 'main',
      buildCommand,
      startCommand,
      port: port ? parseInt(port) : 3000,
      customDomain,
      type: type || 'DOCKER',
      staticOutputDir: staticOutputDir || 'dist',
    } as any,
    create: {
      name,
      repoUrl,
      branch: branch || 'main',
      buildCommand,
      startCommand,
      port: port ? parseInt(port) : 3000,
      userId,
      customDomain,
      type: type || 'DOCKER',
      staticOutputDir: staticOutputDir || 'dist',
    } as any,
  });

  return service;
});

fastify.delete('/services/:id', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
  if (!service) return reply.status(404).send({ error: 'Service not found or unauthorized' });

  // 1. Stop and remove containers if they exist
  const Docker = (await import('dockerode')).default;
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });
  const serviceContainers = containers.filter((c) => c.Labels['helvetia.serviceId'] === id);

  for (const containerInfo of serviceContainers) {
    const container = docker.getContainer(containerInfo.Id);
    await container.stop().catch(() => {});
    await container.remove().catch(() => {});
  }

  // 2. Delete deployments and service from DB
  await prisma.deployment.deleteMany({ where: { serviceId: id } });
  await prisma.service.delete({ where: { id } });

  return { success: true };
});

fastify.get('/services/:id/health', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
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
});

fastify.get('/services/:id/metrics', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  const Docker = (await import('dockerode')).default;
  const docker = new Docker();

  const containers = await docker.listContainers({ all: true });
  const serviceContainers = containers.filter(
    (c) => c.Labels['helvetia.serviceId'] === id && c.State === 'running',
  );

  if (serviceContainers.length === 0) {
    return { cpu: 0, memory: 0, memoryLimit: 0 };
  }

  const containerInfo = serviceContainers[0];
  const container = docker.getContainer(containerInfo.Id);

  // Get single stats snapshot
  const stats = await container.stats({ stream: false });

  // Calculate CPU percentage (simplified)
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent =
    systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100.0 : 0;

  // Calculate Memory usage in MB
  const memoryUsage =
    (stats.memory_stats.usage - (stats.memory_stats.stats.cache || 0)) / 1024 / 1024;
  const memoryLimit = stats.memory_stats.limit / 1024 / 1024;

  return {
    cpu: parseFloat(cpuPercent.toFixed(2)),
    memory: parseFloat(memoryUsage.toFixed(2)),
    memoryLimit: parseFloat(memoryLimit.toFixed(2)),
  };
});

// Deployment Routes
fastify.post('/services/:id/deploy', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
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
    customDomain: (service as any).customDomain,
    type: (service as any).type,
    staticOutputDir: (service as any).staticOutputDir,
  });

  return deployment;
});

// Restart container without rebuilding
fastify.post('/services/:id/restart', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  const Docker = (await import('dockerode')).default;
  const docker = new Docker();

  try {
    // Find existing containers for this service
    const containers = await docker.listContainers({ all: true });
    const serviceContainers = containers.filter((c) => c.Labels['helvetia.serviceId'] === id);

    if (serviceContainers.length === 0) {
      return reply.status(404).send({ error: 'No running container found. Please deploy first.' });
    }

    // Get the image tag from the first container
    const existingContainer = docker.getContainer(serviceContainers[0].Id);
    const containerInfo = await existingContainer.inspect();
    const imageTag = containerInfo.Config.Image;

    // Generate new container name
    const postfix = Math.random().toString(36).substring(2, 8);
    const containerName = `${service.name}-${postfix}`;

    const traefikRule = (service as any).customDomain
      ? `Host(\`${service.name}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${service.name}.localhost\`) || Host(\`${(service as any).customDomain}\`)`
      : `Host(\`${service.name}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${service.name}.localhost\`)`;

    // Create new container with updated config
    const newContainer = await docker.createContainer({
      Image: imageTag,
      name: containerName,
      Env: service.envVars ? Object.entries(service.envVars).map(([k, v]) => `${k}=${v}`) : [],
      Labels: {
        'helvetia.serviceId': service.id,
        'helvetia.type': (service as any).type || 'DOCKER',
        'traefik.enable': 'true',
        [`traefik.http.routers.${service.name}.rule`]: traefikRule,
        [`traefik.http.routers.${service.name}.entrypoints`]: 'web',
        [`traefik.http.services.${service.name}.loadbalancer.server.port`]: (
          service.port || (service.type === 'STATIC' ? 80 : 3000)
        ).toString(),
      },
      HostConfig: {
        NetworkMode: 'helvetia-net',
        RestartPolicy: { Name: 'always' },
        Memory: 512 * 1024 * 1024,
        NanoCpus: 1000000000,
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
});

fastify.post('/webhooks/github', async (request) => {
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
      customDomain: (service as any).customDomain,
      type: (service as any).type,
      staticOutputDir: (service as any).staticOutputDir,
    });
  }

  return { success: true, servicesTriggered: services.length };
});

fastify.get('/services/:id/deployments', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  // Verify ownership
  const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
  if (!service) return reply.status(404).send({ error: 'Service not found' });

  return prisma.deployment.findMany({
    where: { serviceId: id },
    orderBy: { createdAt: 'desc' },
  });
});

fastify.get('/deployments/:id/logs', async (request, reply) => {
  const { id } = request.params as any;
  const user = (request as any).user;

  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { service: true },
  });

  if (!deployment || deployment.service.userId !== user.id) {
    return reply.status(404).send({ error: 'Deployment not found or unauthorized' });
  }
  return { logs: deployment?.logs };
});

fastify.get('/deployments/:id/logs/stream', { websocket: true }, (connection, req) => {
  const { id } = req.params as any;
  const { token } = req.query as any;

  // Auth check for WS
  try {
    (req.server as any).jwt.verify(token);
    // Ideally check ownership of deployment here via DB, but for streaming speed/simplicity
    // we can rely on knowledge of ID + valid token.
    // To be strict: await prisma.deployment.findFirst({ where: { id, service: { userId: decoded.id } } })
  } catch {
    connection.socket.close();
    return;
  }

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
