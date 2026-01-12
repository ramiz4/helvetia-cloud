import type { DeploymentContext, DeploymentResult, IDeploymentStrategy } from '../interfaces';
import { DockerfileBuilder } from '../utils/builders';
import { ensureNetworkExists, getNetworkName } from '../utils/containerHelpers';
import { getSecureBindMounts } from '../utils/workspace';

/**
 * Strategy for deploying static sites
 * Handles static frontend applications served via Nginx
 */
export class StaticDeploymentStrategy implements IDeploymentStrategy {
  canHandle(type: string): boolean {
    return type === 'STATIC';
  }

  async deploy(context: DeploymentContext): Promise<DeploymentResult> {
    const {
      docker,
      deploymentId,
      serviceName,
      repoUrl,
      branch,
      buildCommand,
      staticOutputDir,
      envVars,
      username,
    } = context;

    let buildLogs = '';
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
      const startMsg = `==== Building static site image ${imageTag} ====\n\n`;
      console.log(startMsg.trim());
      context.onLog?.(startMsg);
      buildLogs += startMsg;

      // 2. Generate Dockerfile content for static site
      // ...
      const dockerfileContent = DockerfileBuilder.buildStaticSite({
        envVars,
        buildCommand,
        staticOutputDir,
      });

      // 3. Create Nginx configuration
      const nginxConfig = `server {
  listen 80;
  location / {
    root /usr/share/nginx/html;
    index index.html index.htm;
    try_files $uri $uri/ /index.html;
  }
}`;

      // 4. Prepare build script
      const buildScript = `
        set -e
        apk add --no-cache git
        mkdir -p /app
        git clone --depth 1 --branch ${branch} ${repoUrl} /app
        cd /app
        if [ ! -f Dockerfile ]; then
          echo "Generating Dockerfile for Static Site..."
          cat > Dockerfile <<'EOF'
${dockerfileContent}
EOF

          # Create Nginx config
          cat > nginx.conf <<'NGINX_EOF'
${nginxConfig}
NGINX_EOF

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

      // 5. Execute build
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
        throw new Error(`Static site build failed with exit code ${execResult.ExitCode}`);
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
