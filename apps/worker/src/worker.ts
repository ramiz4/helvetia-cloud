import { Job, Worker } from 'bullmq';
import { prisma } from 'database';
import Docker from 'dockerode';
import dotenv from 'dotenv';
import IORedis from 'ioredis';
import { createScrubber } from './utils/logs';

dotenv.config();

const docker = new Docker();
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const worker = new Worker(
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
      type,
      staticOutputDir,
    } = job.data;

    let builder: Docker.Container | null = null;

    // Prepare secrets for scrubbing
    const secrets = envVars
      ? (Object.values(envVars).filter((v) => typeof v === 'string' && v.length > 0) as string[])
      : [];
    const scrubLogs = createScrubber(secrets);

    console.log(`Starting deployment ${deploymentId} for service ${serviceName}`);

    try {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'BUILDING' },
      });

      let imageTag = `helvetia/${serviceName}:latest`;
      const isDatabase = ['POSTGRES', 'REDIS', 'MYSQL'].includes(type);

      if (isDatabase) {
        if (type === 'POSTGRES') imageTag = 'postgres:15-alpine';
        else if (type === 'REDIS') imageTag = 'redis:7-alpine';
        else if (type === 'MYSQL') imageTag = 'mysql:8';

        console.log(`Managed service ${type} detected. Using image ${imageTag}. Pulling image...`);

        // Explicitly pull the database image
        try {
          const stream = await docker.pull(imageTag);
          await new Promise((resolve, reject) => {
            docker.modem.followProgress(stream, (err: Error | null, res: any[]) => {
              if (err) reject(err);
              else resolve(res);
            });
          });
          console.log(`Successfully pulled ${imageTag}`);
        } catch (pullError) {
          console.error(`Failed to pull image ${imageTag}:`, pullError);
          throw new Error(`Failed to pull database image: ${pullError}`);
        }

        await prisma.deployment.update({
          where: { id: deploymentId },
          data: { logs: `Managed service deployment. Pulled official image ${imageTag}.` },
        });
      } else {
        // 1. Start Builder (Isolated Environment)
        const builderName = `builder-${deploymentId}`;

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
          echo "Generating Dockerfile for ${type === 'STATIC' ? 'Static Site' : 'Docker Service'}..."

          if [ "${type}" = "STATIC" ]; then
            # Multi-stage build for static sites
            echo "FROM node:22-alpine AS builder" > Dockerfile
            echo "RUN apk add --no-cache git" >> Dockerfile
            echo "RUN npm install -g pnpm" >> Dockerfile
            echo "WORKDIR /app" >> Dockerfile

            if [ -n "${envVars && Object.keys(envVars).length > 0 ? 'true' : ''}" ]; then
              echo '${Object.keys(envVars || {})
                .map((key) => `ARG ${key}`)
                .join('\\n')}' >> Dockerfile
            fi

            echo "COPY package*.json pnpm-lock.yaml* ./" >> Dockerfile
            echo "RUN pnpm install" >> Dockerfile
            echo "COPY . ." >> Dockerfile

            if [ -n "${envVars && Object.keys(envVars).length > 0 ? 'true' : ''}" ]; then
              echo '${Object.entries(envVars || {})
                .map(([k, v]) => `ENV ${k}="${v}"`)
                .join('\\n')}' >> Dockerfile
            fi

            echo "RUN ${buildCommand || 'pnpm build'}" >> Dockerfile

            # Debugging: List files after build to help user find the correct output directory
            echo "RUN ls -R /app | grep ': ' || true" >> Dockerfile

            # Create SPA-friendly Nginx config
            echo 'server {
              listen 80;
              location / {
                root /usr/share/nginx/html;
                index index.html index.htm;
                try_files $uri $uri/ /index.html;
              }
            }' > nginx.conf

            echo "" >> Dockerfile
            echo "FROM nginx:alpine" >> Dockerfile
            # Remove default Nginx content to avoid conflicts
            echo "RUN rm -rf /usr/share/nginx/html/*" >> Dockerfile
            # Copy build artifacts
            echo "COPY --from=builder /app/${staticOutputDir || 'dist'} /usr/share/nginx/html" >> Dockerfile
            # Copy custom nginx config
            echo "COPY nginx.conf /etc/nginx/conf.d/default.conf" >> Dockerfile
            echo "EXPOSE 80" >> Dockerfile
            echo 'CMD ["nginx", "-g", "daemon off;"]' >> Dockerfile
          else
            # Standard Docker build
            echo "FROM node:22-alpine" > Dockerfile
            echo "RUN apk add --no-cache git build-base python3" >> Dockerfile
            echo "RUN npm install -g pnpm" >> Dockerfile
            echo "WORKDIR /app" >> Dockerfile

            if [ -n "${envVars && Object.keys(envVars).length > 0 ? 'true' : ''}" ]; then
              echo '${Object.keys(envVars || {})
                .map((key) => `ARG ${key}`)
                .join('\\n')}' >> Dockerfile
            fi

            echo "COPY package*.json pnpm-lock.yaml* ./" >> Dockerfile
            echo "RUN pnpm install" >> Dockerfile
            echo "COPY . ." >> Dockerfile

            if [ -n "${envVars && Object.keys(envVars).length > 0 ? 'true' : ''}" ]; then
              echo '${Object.entries(envVars || {})
                .map(([k, v]) => `ENV ${k}="${v}"`)
                .join('\\n')}' >> Dockerfile
            fi

            echo "RUN ${buildCommand || 'pnpm build'}" >> Dockerfile
            echo "EXPOSE ${port || 3000}" >> Dockerfile
            echo 'CMD ["sh", "-c", "${startCommand || 'pnpm start'}"]' >> Dockerfile
          fi

          echo "node_modules" > .dockerignore
          echo ".git" >> .dockerignore
          echo ".next" >> .dockerignore
          # We don't ignore 'dist' here because it might be the target
          # output directory for static sites in some configurations
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
      }

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
        Cmd:
          type === 'REDIS' && envVars?.REDIS_PASSWORD
            ? ['redis-server', '--requirepass', envVars.REDIS_PASSWORD]
            : undefined,
        Labels: {
          'helvetia.serviceId': serviceId,
          'helvetia.type': type || 'DOCKER',
          'traefik.enable': 'true',
          [`traefik.http.routers.${serviceName}.rule`]: traefikRule,
          [`traefik.http.routers.${serviceName}.entrypoints`]: 'web',
          [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: (
            port || (type === 'STATIC' ? 80 : 3000)
          ).toString(),
        },
        HostConfig: {
          NetworkMode: 'helvetia-net',
          RestartPolicy: { Name: 'always' },
          Memory: 512 * 1024 * 1024, // 512MB limit
          NanoCpus: 1000000000, // 1 CPU core limit
          Binds:
            type === 'POSTGRES'
              ? [`helvetia-data-${serviceName}:/var/lib/postgresql/data`]
              : type === 'REDIS'
                ? [`helvetia-data-${serviceName}:/data`]
                : type === 'MYSQL'
                  ? [`helvetia-data-${serviceName}:/var/lib/mysql`]
                  : [],
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

// Removed auto-start for testing
// console.log('Worker started and listening for jobs...');
