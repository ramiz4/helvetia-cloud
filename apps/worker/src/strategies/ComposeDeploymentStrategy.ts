import type { DeploymentContext, DeploymentResult, IDeploymentStrategy } from '../interfaces';
import { ComposeFileBuilder } from '../utils/builders';
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
    } = context;

    let buildLogs = '';

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
        NetworkMode: 'helvetia-net',
      },
    });

    try {
      await builder.start();
      console.log(`Starting Docker Compose deployment for ${serviceName}...`);

      // 2. Generate Traefik rule
      const traefikRule = customDomain
        ? `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${serviceName}.localhost\`) || Host(\`${customDomain}\`)`
        : `Host(\`${serviceName}.${process.env.PLATFORM_DOMAIN || 'helvetia.cloud'}\`) || Host(\`${serviceName}.localhost\`)`;

      // 3. Generate compose override file
      const mainService = startCommand || 'app'; // User-provided service name
      const overrideYaml = ComposeFileBuilder.generateOverride({
        serviceName,
        serviceId,
        mainService,
        traefikRule,
        port,
        envVars,
      });

      // 4. Prepare build script
      /* eslint-disable no-useless-escape */
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
      /* eslint-enable no-useless-escape */

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
          buildLogs += chunk.toString();
          console.log(chunk.toString());
        });
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const execResult = await exec.inspect();
      if (execResult.ExitCode !== 0) {
        throw new Error(`Compose deployment failed with exit code ${execResult.ExitCode}`);
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
