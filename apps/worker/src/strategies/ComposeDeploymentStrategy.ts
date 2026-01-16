import { PLATFORM_DOMAIN } from 'shared';
import type { DeploymentContext, DeploymentResult, IDeploymentStrategy } from '../interfaces';
import { ComposeFileBuilder } from '../utils/builders';
import { ensureImageExists, ensureNetworkExists, getNetworkName } from '../utils/containerHelpers';
import { getSecureBindMounts } from '../utils/workspace';

/**
 * Strategy for deploying Docker Compose projects
 * Handles multi-container applications defined in docker-compose.yml
 */
export class ComposeDeploymentStrategy implements IDeploymentStrategy {
  canHandle(type: string): boolean {
    return type === 'COMPOSE';
  }

  async deploy(context: DeploymentContext): Promise<DeploymentResult> {
    const {
      docker,
      deploymentId,
      serviceName,
      serviceId,
      repoUrl,
      branch,
      buildCommand,
      startCommand,
      port,
      envVars,
      customDomain,
      username,
      volumes,
    } = context;

    let buildLogs = '';

    // Determine network name
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
        AutoRemove: true,
        Binds: getSecureBindMounts(),
        NetworkMode: networkName,
      },
    });

    try {
      await builder.start();
      const startMsg = `==== Starting Docker Compose deployment for ${serviceName} ====\n\n`;
      console.log(startMsg.trim());
      context.onLog?.(startMsg);
      buildLogs += startMsg;

      // 2. Generate Traefik rule
      const hosts = [`${serviceName}.${PLATFORM_DOMAIN}`, `${serviceName}.localhost`];

      if (customDomain) {
        hosts.push(customDomain);
      }

      if (context.projectName) {
        hosts.push(`${context.projectName}-${serviceName}.${PLATFORM_DOMAIN}`);
        hosts.push(`${context.projectName}-${serviceName}.localhost`);
      }

      if (context.projectName && context.environmentName && context.username) {
        const sanitizedUsername = context.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const uHost = `${sanitizedUsername}.${context.projectName}.${context.environmentName}.${serviceName}`;
        hosts.push(`${uHost}.${PLATFORM_DOMAIN}`);
        hosts.push(`${uHost}.localhost`);
      }

      const traefikRule = hosts.map((h) => `Host(\`${h}\`)`).join(' || ');

      // 3. Generate compose override file
      const mainService = startCommand || 'app'; // User-provided service name
      const overrideYaml = ComposeFileBuilder.generateOverride({
        serviceName,
        serviceId,
        mainService,
        traefikRule,
        port,
        envVars,
        projectName: context.projectName,
        environmentName: context.environmentName,
        username: context.username,
        volumes,
      });

      // 4. Prepare build script
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

        # Detect Compose file
        COMPOSE_FILE="docker-compose.yml"
        if [ -n "${buildCommand || ''}" ]; then
          COMPOSE_FILE="${buildCommand}"
        else
          if [ -f "compose.yaml" ]; then
            COMPOSE_FILE="compose.yaml"
          elif [ -f "compose.yml" ]; then
            COMPOSE_FILE="compose.yml"
          elif [ -f "docker-compose.yaml" ]; then
            COMPOSE_FILE="docker-compose.yaml"
          fi
        fi

        if [ ! -f "$COMPOSE_FILE" ]; then
          echo "Error: Compose file '$COMPOSE_FILE' not found!"
          ls -R
          exit 1
        fi

        echo "Using Compose file: $COMPOSE_FILE"

        echo "=== DEBUG: File Structure ==="
        ls -F

        echo "=== DEBUG: Compose Configuration ==="
        docker compose -f "$COMPOSE_FILE" -f /tmp/docker-compose.override.yml config || echo "Starting anyway..."

        # Use project name = project-env-service to namespace it.
        # Point to the override file in /tmp
        PROJECT_NAME="${context.projectName ? `${context.projectName}-${context.environmentName || 'global'}-` : ''}${serviceName}"
        docker compose -f "$COMPOSE_FILE" -f /tmp/docker-compose.override.yml -p "$PROJECT_NAME" up -d --build --remove-orphans
      `;

      // 5. Execute deployment
      const exec = await builder.exec({
        Cmd: ['sh', '-c', buildScript],
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          const log = chunk.toString();
          buildLogs += log;
          context.onLog?.(log);
        });
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const execResult = await exec.inspect();
      if (execResult.ExitCode !== 0) {
        throw new Error(
          `Compose deployment failed with exit code ${execResult.ExitCode}\nBuild Logs:\n${buildLogs}`,
        );
      }

      // For compose, we don't have a single image tag
      const imageTag = `compose:${serviceName}`;

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
