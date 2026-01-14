import type { DeploymentContext, DeploymentResult, IDeploymentStrategy } from '../interfaces';
import { DockerfileBuilder } from '../utils/builders';
import { ensureImageExists, ensureNetworkExists, getNetworkName } from '../utils/containerHelpers';
import { getSecureBindMounts } from '../utils/workspace';

/**
 * Strategy for deploying standard Docker services
 * Handles basic containerized applications (Node.js, Python, etc.)
 */
export class DockerDeploymentStrategy implements IDeploymentStrategy {
  canHandle(type: string): boolean {
    return type === 'DOCKER';
  }

  async deploy(context: DeploymentContext): Promise<DeploymentResult> {
    const {
      docker,
      deploymentId,
      serviceName,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port,
      envVars,
      username,
    } = context;

    let buildLogs = '';

    // Check if repoUrl is actually a container image reference (not a URL)
    const isContainerImage =
      !repoUrl.startsWith('http://') &&
      !repoUrl.startsWith('https://') &&
      !repoUrl.startsWith('git@') &&
      !repoUrl.startsWith('ssh://');

    if (isContainerImage) {
      // Use branch as tag if provided, defaulting to latest
      const tag = branch && branch !== 'main' ? branch : 'latest';
      const cleanRepoUrl = repoUrl.endsWith(':latest') ? repoUrl.replace(':latest', '') : repoUrl;
      const fullImage = `${cleanRepoUrl}:${tag}`;
      const { githubToken } = context;

      context.onLog?.(`==== Pulling Pre-built Image: ${fullImage} ====\n\n`);

      try {
        const pullOptions: Record<string, unknown> = {};
        if (githubToken && fullImage.includes('ghcr.io')) {
          pullOptions.authconfig = {
            username: 'x-access-token', // Works with GitHub tokens
            password: githubToken,
            serveraddress: 'ghcr.io',
          };
          context.onLog?.(`🔑 Using GitHub authentication for GHCR...\n\n`);
        }

        const stream = await docker.pull(fullImage, pullOptions);
        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(
            stream,
            (err, _res) => {
              if (err) reject(err);
              else resolve();
            },
            (event) => {
              const status = event.status || '';
              const progress = event.progress || '';
              const id = event.id ? `[${event.id}] ` : '';
              const logLine = `${id}${status} ${progress}\n`;
              buildLogs += logLine;
              context.onLog?.(logLine);
            },
          );
        });

        context.onLog?.(`✅ Successfully pulled image: ${fullImage}\n\n`);

        return {
          imageTag: fullImage,
          buildLogs: buildLogs || `Successfully pulled image: ${fullImage}`,
          success: true,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        context.onLog?.(`\n❌ Failed to pull image: ${errorMessage}\n`);
        throw error;
      }
    }

    const imageTag = `helvetia/${serviceName}:latest`;

    const networkName = getNetworkName({
      username,
      projectName: context.projectName,
      environmentName: context.environmentName,
    });

    // Ensure networks exist before builder starts
    await ensureNetworkExists(docker, 'helvetia-net');
    if (networkName !== 'helvetia-net') {
      await ensureNetworkExists(docker, networkName, context.projectName);
    }

    // Ensure builder image exists
    await ensureImageExists(docker, 'docker:cli');

    // 1. Create builder container
    const builderName = `builder-${deploymentId}`;
    const builder = await docker.createContainer({
      Image: 'docker:cli',
      name: builderName,
      Entrypoint: ['sleep', '3600'],
      Env: process.env.DOCKER_HOST ? [`DOCKER_HOST=${process.env.DOCKER_HOST}`] : [],
      HostConfig: {
        Binds: getSecureBindMounts(),
        NetworkMode: 'helvetia-net',
      },
    });

    try {
      await builder.start();
      const startMsg = `Building image ${imageTag} in isolated environment...\n`;
      buildLogs += startMsg;
      context.onLog?.(startMsg);

      // 2. Generate Dockerfile content
      const dockerfileContent = DockerfileBuilder.buildNodeService({
        envVars,
        buildCommand,
        startCommand,
        port,
      });

      // 3. Prepare build script
      const buildScript = `
        set -e
        apk add --no-cache git
        mkdir -p /app
        git clone --depth 1 --branch ${branch} ${repoUrl} /app
        cd /app
        if [ ! -f Dockerfile ]; then
          echo "Generating Dockerfile for Docker Service..."
          cat > Dockerfile <<'EOF'
${dockerfileContent}
EOF

          echo "node_modules" > .dockerignore
          echo ".git" >> .dockerignore
          echo ".next" >> .dockerignore
          echo "temp" >> .dockerignore

          echo ""
          echo "===== Validating Generated Dockerfile ====="
          cat Dockerfile
          echo ""

          # Basic validation checks
          if ! grep -q "^FROM " Dockerfile; then
            echo "ERROR: Dockerfile must start with a FROM instruction"
            exit 1
          fi

          if ! grep -qE "^(CMD|ENTRYPOINT) " Dockerfile; then
            echo "WARNING: Dockerfile should contain a CMD or ENTRYPOINT instruction"
          fi

          echo "✅ Dockerfile syntax validation passed"
          echo ""
        fi

        echo "===== Starting Docker Build ====="
        docker build --load -t ${imageTag} .
      `;

      // 4. Execute build
      const exec = await builder.exec({
        Cmd: ['sh', '-c', buildScript],
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          const log = chunk
            .toString()
            .replace(/\0/g, '')
            // eslint-disable-next-line no-control-regex
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
          buildLogs += log;
          context.onLog?.(log);
        });
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const execResult = await exec.inspect();
      if (execResult.ExitCode !== 0) {
        throw new Error(`Build failed with exit code ${execResult.ExitCode}`);
      }

      return {
        imageTag,
        buildLogs,
        success: true,
      };
    } finally {
      // Cleanup builder container
      try {
        const builderInfo = await builder.inspect();
        if (builderInfo.State.Running) {
          await builder.stop({ t: 5 });
        }
        await builder.remove({ force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup builder container:', cleanupError);
      }
    }
  }
}
