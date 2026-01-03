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
    const { deploymentId, serviceId, repoUrl, branch, buildCommand, startCommand, serviceName } = job.data;
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
WORKDIR /app
COPY . .
RUN ${buildCommand || 'npm install'}
EXPOSE 3000
CMD [${(startCommand || 'npm start').split(' ').map((s: string) => `"${s}"`).join(', ')}]
`;
        await fs.writeFile(dockerfilePath, content);
      }

      // 3. Build Image
      const imageTag = `helvetia/${serviceName}:latest`;
      console.log(`Building image ${imageTag}...`);

      const stream = await docker.buildImage(
        { context: workDir, src: ['.'] },
        { t: imageTag }
      );

      await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }, (event) => {
          console.log(event.stream);
          // Pipe logs to DB in a real app, for MVP we'll just log to console
        });
      });

      // 4. Run Container (and stop old one)
      console.log(`Starting container for ${serviceName}...`);

      // Stop existing container if any
      const containers = await docker.listContainers({ all: true });
      const oldContainer = containers.find(c => c.Names.includes(`/${serviceName}`));
      if (oldContainer) {
        const container = docker.getContainer(oldContainer.Id);
        await container.stop().catch(() => { });
        await container.remove().catch(() => { });
      }

      await docker.createContainer({
        Image: imageTag,
        name: serviceName,
        Env: job.data.envVars ? Object.entries(job.data.envVars).map(([k, v]) => `${k}=${v}`) : [],
        Labels: {
          'traefik.enable': 'true',
          [`traefik.http.routers.${serviceName}.rule`]: `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'localhost'}\`)`,
          [`traefik.http.routers.${serviceName}.entrypoints`]: 'web',
          [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: '3000',
        },
        HostConfig: {
          NetworkMode: 'helvetia-net',
          RestartPolicy: { Name: 'always' },
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
