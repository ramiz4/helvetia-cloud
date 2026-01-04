import { Job, Worker } from 'bullmq';
import { prisma } from 'database';
import Docker from 'dockerode';
import dotenv from 'dotenv';
import IORedis from 'ioredis';

dotenv.config();

const docker = new Docker();
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

new Worker(
  'deployments',
  async (job: Job) => {
    const {
      deploymentId,
      serviceId,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      serviceName,
      port,
      envVars,
      customDomain,
    } = job.data;

    let builder: Docker.Container | null = null;

    // Prepare secrets for scrubbing
    const secrets = envVars
      ? (Object.values(envVars).filter((v) => typeof v === 'string' && v.length > 0) as string[])
      : [];
    const scrubLogs = (log: string) => {
      let cleaned = log;
      for (const secret of secrets) {
        if (secret.length >= 3) {
          cleaned = cleaned.split(secret).join('[REDACTED]');
        }
      }
      return cleaned;
    };

    console.log(`Starting deployment ${deploymentId} for service ${serviceName}`);

    try {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'BUILDING' },
      });

      // 1. Start Builder (Isolated Environment)
      const builderName = `builder-${deploymentId}`;
      const imageTag = `helvetia/${serviceName}:latest`;

      // Ensure docker:cli is present (pulled in setup or earlier)
      builder = await docker.createContainer({
        Image: 'docker:cli',
        name: builderName,
        Entrypoint: ['sleep', '3600'],
        HostConfig: {
          AutoRemove: true,
          Binds: ['/var/run/docker.sock:/var/run/docker.sock'],
        },
      });
      await builder.start();

      console.log(`Building image ${imageTag} in isolated environment...`);

      // 2. Prepare Build Script
      const buildScript = `
        set -e
        apk add --no-cache git
        mkdir -p /app
        git clone --depth 1 --branch ${branch} ${repoUrl} /app
        cd /app
        if [ ! -f Dockerfile ]; then
          echo "Generating Dockerfile..."
          echo "FROM node:22-alpine" > Dockerfile
          echo "RUN apk add --no-cache git build-base python3" >> Dockerfile
          echo "RUN npm install -g pnpm" >> Dockerfile
          echo "WORKDIR /app" >> Dockerfile

          # Add ARG declarations for build-time env vars (needed for Vite/static apps)
          if [ -n "${envVars}" ]; then
            echo '${Object.keys(envVars || {})
              .map((key) => `ARG ${key}`)
              .join('\\n')}' >> Dockerfile
          fi

          echo "COPY package*.json pnpm-lock.yaml* ./" >> Dockerfile
          echo "RUN pnpm install --frozen-lockfile" >> Dockerfile
          echo "COPY . ." >> Dockerfile

          # Set env vars before build (for Vite to embed them)
          if [ -n "${envVars}" ]; then
            echo '${Object.entries(envVars || {})
              .map(([k, v]) => `ENV ${k}="${v}"`)
              .join('\\n')}' >> Dockerfile
          fi

          echo "RUN ${buildCommand || 'pnpm build'}" >> Dockerfile
          echo "EXPOSE ${port || 3000}" >> Dockerfile
          echo 'CMD ["sh", "-c", "${startCommand || 'pnpm start'}"]' >> Dockerfile

          echo "node_modules" > .dockerignore
          echo ".git" >> .dockerignore
          echo ".next" >> .dockerignore
          echo "dist" >> .dockerignore
          echo "temp" >> .dockerignore
        fi
        docker build -t ${imageTag} .
      `;

      let buildLogs = '';

      // 3. Execute Build
      const exec = await builder.exec({
        Cmd: ['sh', '-c', buildScript],
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });

      await new Promise((resolve, reject) => {
        stream.on('data', async (chunk: Buffer) => {
          const text = chunk.toString();
          const clean = scrubLogs(text);
          buildLogs += clean;
          console.log(clean);
          await redisConnection.publish(`deployment-logs:${deploymentId}`, clean);
        });
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const execResult = await exec.inspect();
      if (execResult.ExitCode !== 0) {
        throw new Error(`Build failed with exit code ${execResult.ExitCode}`);
      }

      // Sanitize logs for PostgreSQL (remove null bytes and invalid UTF8)
      /* eslint-disable no-control-regex */
      const sanitizedLogs = buildLogs
        .replace(/\0/g, '')
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
      /* eslint-enable no-control-regex */

      // Update logs in DB
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { logs: sanitizedLogs },
      });

      // 4. Run Container (and stop old one)
      console.log(`Starting container for ${serviceName}...`);

      // Generate a random postfix
      const postfix = Math.random().toString(36).substring(2, 8);
      const containerName = `${serviceName}-${postfix}`;

      const traefikRule = customDomain
        ? `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${serviceName}.localhost\`) || Host(\`${customDomain}\`)`
        : `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${serviceName}.localhost\`)`;

      const newContainer = await docker.createContainer({
        Image: imageTag,
        name: containerName,
        Env: envVars ? Object.entries(envVars).map(([k, v]) => `${k}=${v}`) : [],
        Labels: {
          'helvetia.serviceId': serviceId,
          'traefik.enable': 'true',
          [`traefik.http.routers.${serviceName}.rule`]: traefikRule,
          [`traefik.http.routers.${serviceName}.entrypoints`]: 'web',
          [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: (
            port || 3000
          ).toString(),
        },
        HostConfig: {
          NetworkMode: 'helvetia-net',
          RestartPolicy: { Name: 'always' },
          Memory: 512 * 1024 * 1024, // 512MB limit
          NanoCpus: 1000000000, // 1 CPU core limit
          LogConfig: {
            Type: 'json-file',
            Config: {},
          },
        },
      });

      await newContainer.start();
      console.log(`New container ${containerName} started.`);

      // 5. Cleanup old containers (Zero-Downtime: Do this AFTER starting the new one)
      console.log(`Cleaning up old containers for ${serviceName}...`);
      const containers = await docker.listContainers({ all: true });
      const oldContainers = containers.filter(
        (c) =>
          c.Labels['helvetia.serviceId'] === serviceId &&
          c.Names.some((name) => !name.includes(postfix)),
      );

      for (const old of oldContainers) {
        const container = docker.getContainer(old.Id);
        // Wait a small grace period for Traefik to switch traffic if needed
        // In a more robust system, we would check health here.
        await container.stop().catch(() => {});
        await container.remove().catch(() => {});
      }

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'SUCCESS', imageTag },
      });

      await prisma.service.update({
        where: { id: serviceId },
        data: { status: 'ACTIVE' },
      });

      console.log(`Deployment ${deploymentId} successful!`);
    } catch (error) {
      console.error(`Deployment ${deploymentId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'FAILED', logs: errorMessage },
      });
      await prisma.service.update({
        where: { id: serviceId },
        data: { status: 'FAILED' },
      });
    } finally {
      if (builder) {
        await builder.remove({ force: true }).catch(() => {});
      }
    }
  },
  { connection: redisConnection },
);

console.log('Worker started and listening for jobs...');
