import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from 'database';
import Docker from 'dockerode';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);
const docker = new Docker();
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'deployments',
  async (job: Job) => {
    const { deploymentId, serviceId, repoUrl, branch, buildCommand, startCommand, serviceName, port } = job.data;
    const workDir = path.join(__dirname, '../temp', deploymentId);

    console.log(`Starting deployment ${deploymentId} for service ${serviceName}`);

    try {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'BUILDING' },
      });

      // 1. Clone Repo
      await fs.mkdir(workDir, { recursive: true });
      await execAsync(`git clone --depth 1 --branch ${branch} ${repoUrl} .`, { cwd: workDir });

      // 2. Create Dockerfile if not exists
      const dockerfilePath = path.join(workDir, 'Dockerfile');
      try {
        await fs.access(dockerfilePath);
      } catch {
        // Generate a basic Node.js Dockerfile
        const content = `
FROM node:22-alpine
RUN apk add --no-cache git build-base python3
RUN npm install -g pnpm
WORKDIR /app
COPY . .
RUN ${buildCommand || 'pnpm install'}
EXPOSE ${port || 3000}
CMD ${startCommand || 'npm start'}
`;
        await fs.writeFile(dockerfilePath, content);
      }

      // 3. Build Image
      const imageTag = `helvetia/${serviceName}:latest`;
      console.log(`Building image ${imageTag}...`);

      let buildLogs = '';

      const stream = await docker.buildImage(
        { context: workDir, src: ['.'] },
        { t: imageTag }
      );

      await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, res) => {
          if (err) return reject(err);
          const lastRes = res && res[res.length - 1];
          if (lastRes && lastRes.error) return reject(new Error(lastRes.error));
          resolve(res);
        }, async (event) => {
          if (event.stream) {
            buildLogs += event.stream;
            console.log(event.stream);
            // Publish to Redis for real-time streaming
            await redisConnection.publish(`deployment-logs:${deploymentId}`, event.stream);
          }
          if (event.error) {
            const errorMsg = `\nERROR: ${event.error}\n`;
            buildLogs += errorMsg;
            console.error('Build error:', event.error);
            await redisConnection.publish(`deployment-logs:${deploymentId}`, errorMsg);
          }
        });
      });

      // Update logs in DB
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { logs: buildLogs },
      });

      // 4. Run Container (and stop old one)
      console.log(`Starting container for ${serviceName}...`);

      // Generate a random postfix
      const postfix = Math.random().toString(36).substring(2, 8);
      const containerName = `${serviceName}-${postfix}`;

      // Stop existing containers for this service if any (using label for better accuracy)
      const containers = await docker.listContainers({ all: true });
      const oldContainers = containers.filter(c => c.Labels['helvetia.serviceId'] === serviceId);

      for (const old of oldContainers) {
        const container = docker.getContainer(old.Id);
        await container.stop().catch(() => { });
        await container.remove().catch(() => { });
      }

      await docker.createContainer({
        Image: imageTag,
        name: containerName,
        Env: job.data.envVars ? Object.entries(job.data.envVars).map(([k, v]) => `${k}=${v}`) : [],
        Labels: {
          'helvetia.serviceId': serviceId,
          'traefik.enable': 'true',
          [`traefik.http.routers.${serviceName}.rule`]: `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${serviceName}.localhost\`)`,
          [`traefik.http.routers.${serviceName}.entrypoints`]: 'web',
          [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: (port || 3000).toString(),
        },
        HostConfig: {
          NetworkMode: 'helvetia-net',
          RestartPolicy: { Name: 'always' },
          LogConfig: {
            Type: 'json-file',
            Config: {},
          },
        },
      }).then(container => container.start());

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'SUCCESS', imageTag },
      });

      await prisma.service.update({
        where: { id: serviceId },
        data: { status: 'ACTIVE' },
      });

      console.log(`Deployment ${deploymentId} successful!`);

    } catch (error: any) {
      console.error(`Deployment ${deploymentId} failed:`, error);
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'FAILED', logs: error.message },
      });
      await prisma.service.update({
        where: { id: serviceId },
        data: { status: 'FAILED' },
      });
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => { });
    }
  },
  { connection: redisConnection }
);

console.log('Worker started and listening for jobs...');
