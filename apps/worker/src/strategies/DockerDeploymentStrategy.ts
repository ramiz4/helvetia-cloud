import type { DeploymentContext, DeploymentResult, IDeploymentStrategy } from '../interfaces';
import { DockerfileBuilder } from '../utils/builders';
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
    } = context;

    let buildLogs = '';
    const imageTag = `helvetia/${serviceName}:latest`;

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
      console.log(`Building image ${imageTag} in isolated environment...`);

      // 2. Generate Dockerfile content
      const dockerfileContent = DockerfileBuilder.buildNodeService({
        envVars,
        buildCommand,
        startCommand,
        port,
      });

      // 3. Prepare build script
      /* eslint-disable no-useless-escape */
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
        docker build -t ${imageTag} .
      `;
      /* eslint-enable no-useless-escape */

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
          buildLogs += chunk.toString();
          console.log(chunk.toString());
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
