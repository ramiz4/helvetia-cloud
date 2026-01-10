import { Job, Worker } from 'bullmq';
import { prisma } from 'database';
import Docker from 'dockerode';
import dotenv from 'dotenv';
import IORedis from 'ioredis';
import path from 'path';
import { generateComposeOverride } from './utils/generators';
import { createScrubber } from './utils/logs';
import { withStatusLock } from './utils/statusLock';
import { getSecureBindMounts } from './utils/workspace';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Type for Docker pull progress events
interface DockerPullProgressEvent {
  status?: string;
  id?: string;
  progress?: string;
  progressDetail?: {
    current?: number;
    total?: number;
  };
}

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
    let newContainer: Docker.Container | null = null;
    let oldContainers: Docker.ContainerInfo[] = [];
    let imageTag = '';
    let buildLogs = '';

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

      // Capture old containers before deployment for potential rollback
      const allContainers = await docker.listContainers({ all: true });
      oldContainers = allContainers.filter(
        (c) => c.Labels['helvetia.serviceId'] === serviceId && c.State === 'running',
      );
      console.log(`Found ${oldContainers.length} running containers for rollback if needed`);

      imageTag = `helvetia/${serviceName}:latest`;
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
            docker.modem.followProgress(
              stream,
              (err: Error | null, res: DockerPullProgressEvent[]) => {
                if (err) reject(err);
                else resolve(res);
              },
            );
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
        if (type === 'COMPOSE') {
          // 1. Start Builder (to run compose)
          const builderName = `builder-${deploymentId}`;
          builder = await docker.createContainer({
            Image: 'docker:cli',
            name: builderName,
            Entrypoint: ['sleep', '3600'],
            Env: process.env.DOCKER_HOST ? [`DOCKER_HOST=${process.env.DOCKER_HOST}`] : [],
            HostConfig: {
              AutoRemove: true,
              Binds: getSecureBindMounts(),
              NetworkMode: 'helvetia-net', // Connect to network to access socket proxy
            },
          });
          await builder.start();

          console.log(`Starting Docker Compose deployment for ${serviceName}...`);

          const traefikRule = customDomain
            ? `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${serviceName}.localhost\`) || Host(\`${customDomain}\`)`
            : `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${serviceName}.localhost\`)`;

          const mainService = startCommand || 'app'; // User provided logic name

          const overrideYaml = generateComposeOverride({
            serviceName,
            serviceId,
            mainService,
            traefikRule,
            port,
            envVars,
          });

          const buildScript = `
            set -e
            # Install tools needed for standard Docker Compose usage
            apk add --no-cache docker-cli-compose git

            # Clone repository (local paths are not supported for security)
            echo "Cloning from ${repoUrl}..."
            mkdir -p /app
            git clone --depth 1 --branch ${branch} ${repoUrl} /app
            WORKDIR="/app"

            # Generate Override File in /tmp to avoid polluting source
            cat > /tmp/docker-compose.override.yml <<'EOF'
${overrideYaml}
EOF

            cd "$WORKDIR"
            echo "Deploying with Docker Compose in $WORKDIR..."

            # Use project name = serviceName to namespace it.
            # Point to the override file in /tmp
            docker compose -f "${buildCommand || 'docker-compose.yml'}" -f /tmp/docker-compose.override.yml -p ${serviceName} up -d --build --remove-orphans
          `;

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
            throw new Error(`Compose deployment failed with exit code ${execResult.ExitCode}`);
          }

          // Update logs in DB
          /* eslint-disable no-control-regex */
          const sanitizedLogs = buildLogs
            .replace(/\0/g, '')
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
          /* eslint-enable no-control-regex */

          await prisma.deployment.update({
            where: { id: deploymentId },
            data: { logs: sanitizedLogs, status: 'SUCCESS' },
          });

          // Update service status with distributed lock
          await withStatusLock(serviceId, async () => {
            await prisma.service.update({
              where: { id: serviceId },
              data: { status: 'RUNNING' },
            });
          });

          if (builder) {
            await builder.remove({ force: true }).catch(() => {});
          }
          return;
        }

        // 1. Start Builder (Isolated Environment)
        const builderName = `builder-${deploymentId}`;

        // Ensure docker:cli is present (pulled in setup or earlier)
        builder = await docker.createContainer({
          Image: 'docker:cli',
          name: builderName,
          Entrypoint: ['sleep', '3600'],
          Env: process.env.DOCKER_HOST ? [`DOCKER_HOST=${process.env.DOCKER_HOST}`] : [],
          HostConfig: {
            AutoRemove: true,
            Binds: getSecureBindMounts(),
            NetworkMode: 'helvetia-net', // Connect to network to access socket proxy
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

            ${Object.keys(envVars || {})
              .map((key) => `echo "ARG ${key}" >> Dockerfile`)
              .join('\n            ')}

            echo "COPY package*.json pnpm-lock.yaml* ./" >> Dockerfile
            echo "RUN pnpm install" >> Dockerfile
            echo "COPY . ." >> Dockerfile

            ${Object.entries(envVars || {})
              .map(([k, v]) => `echo "ENV ${k}=${JSON.stringify(v)}" >> Dockerfile`)
              .join('\n            ')}

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

            ${Object.keys(envVars || {})
              .map((key) => `echo "ARG ${key}" >> Dockerfile`)
              .join('\n            ')}

            echo "COPY package*.json pnpm-lock.yaml* ./" >> Dockerfile
            echo "RUN pnpm install" >> Dockerfile
            echo "COPY . ." >> Dockerfile

            ${Object.entries(envVars || {})
              .map(([k, v]) => `echo "ENV ${k}=${JSON.stringify(v)}" >> Dockerfile`)
              .join('\n            ')}

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

      newContainer = await docker.createContainer({
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
      const currentContainers = await docker.listContainers({ all: true });
      const containersToRemove = currentContainers.filter(
        (c) =>
          c.Labels['helvetia.serviceId'] === serviceId &&
          c.Names.some((name) => !name.includes(postfix)),
      );

      for (const old of containersToRemove) {
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

      // Update service status with distributed lock
      await withStatusLock(serviceId, async () => {
        await prisma.service.update({
          where: { id: serviceId },
          data: { status: 'RUNNING' },
        });
      });

      console.log(`Deployment ${deploymentId} successful!`);
    } catch (error) {
      console.error(`Deployment ${deploymentId} failed:`, error);

      // Comprehensive error logging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      const fullErrorLog = [
        '=== DEPLOYMENT FAILURE ===',
        `Error: ${errorMessage}`,
        errorStack ? `Stack Trace:\n${errorStack}` : '',
        buildLogs ? `\n=== BUILD LOGS ===\n${buildLogs}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      console.error('Full error details:', fullErrorLog);

      // Cleanup: Remove failed new container if it was created
      if (newContainer) {
        console.log('Cleaning up failed new container...');
        try {
          await newContainer.stop({ t: 5 }).catch(() => {
            console.log('Failed to stop new container (may not be running)');
          });
          await newContainer.remove({ force: true });
          console.log('Failed new container removed');
        } catch (cleanupError) {
          console.error('Failed to cleanup new container:', cleanupError);
        }
      }

      // Rollback: Restart old containers if they exist
      if (oldContainers.length > 0) {
        console.log(`Rolling back: restarting ${oldContainers.length} old container(s)...`);
        for (const oldContainerInfo of oldContainers) {
          try {
            const container = docker.getContainer(oldContainerInfo.Id);
            const containerState = await container.inspect();

            // Only restart if container was previously running
            if (containerState.State.Running) {
              console.log(`Container ${oldContainerInfo.Id} is still running, no action needed`);
            } else {
              console.log(`Restarting old container ${oldContainerInfo.Id}...`);
              await container.start();
              console.log(`Successfully restarted container ${oldContainerInfo.Id}`);
            }
          } catch (rollbackError) {
            console.error(`Failed to restart old container ${oldContainerInfo.Id}:`, rollbackError);
          }
        }
        console.log('Rollback attempt completed');
      } else {
        console.log('No old containers to rollback to');
      }

      // Update database with detailed error information
      try {
        await prisma.deployment.update({
          where: { id: deploymentId },
          data: {
            status: 'FAILED',
            logs: fullErrorLog.substring(0, 50000), // Limit log size for database
          },
        });

        // Set service status based on rollback success with distributed lock
        const serviceStatus = oldContainers.length > 0 ? 'RUNNING' : 'FAILED';
        await withStatusLock(serviceId, async () => {
          await prisma.service.update({
            where: { id: serviceId },
            data: { status: serviceStatus },
          });
        });

        if (oldContainers.length > 0) {
          console.log(
            'Service status set to RUNNING after rollback attempt; previous containers may still be serving traffic',
          );
        }
      } catch (dbError) {
        console.error('Failed to update database with error status:', dbError);
      }

      // Re-throw to mark job as failed
      throw error;
    } finally {
      // Ensure builder container is always cleaned up
      if (builder) {
        console.log('Cleaning up builder container...');
        try {
          const builderInfo = await builder.inspect();
          console.log(`Builder container state: ${builderInfo.State.Status}`);

          if (builderInfo.State.Running) {
            await builder.stop({ t: 5 });
            console.log('Builder container stopped');
          }

          await builder.remove({ force: true });
          console.log('Builder container removed successfully');
        } catch (cleanupError) {
          console.error('Failed to cleanup builder container:', cleanupError);
          // Try force removal as last resort
          try {
            await builder.remove({ force: true, v: true });
            console.log('Builder container force removed');
          } catch (forceRemoveError) {
            console.error('Even force removal failed:', forceRemoveError);
          }
        }
      }
    }
  },
  { connection: redisConnection },
);

// Removed auto-start for testing
// console.log('Worker started and listening for jobs...');
