import fs from 'fs/promises';

/**
 * Get the workspace directory from environment or use default
 * @returns The workspace directory path
 */
export function getWorkspaceDir(): string {
  return process.env.WORKSPACE_DIR || '/tmp/helvetia-workspaces';
}

/**
 * Ensure the workspace directory exists
 * @returns Promise that resolves when directory is created
 */
export async function ensureWorkspaceDir(): Promise<void> {
  const workspaceDir = getWorkspaceDir();
  await fs.mkdir(workspaceDir, { recursive: true });
}

/**
 * Get secure Docker bind mounts for builder containers.
 *
 * When using Docker Socket Proxy, builder containers don't need direct socket
 * access. Instead, they connect to the proxy via DOCKER_HOST environment variable.
 * The workspace directory is currently unused — all builds happen in /app inside
 * the container's ephemeral filesystem, which is isolated from the host and
 * automatically cleaned up when the container is removed.
 *
 * @returns Array of bind mount strings (empty when using socket proxy)
 */
export function getSecureBindMounts(): string[] {
  // When DOCKER_HOST is set to tcp://docker-socket-proxy:2375, no socket mount needed
  // The builder container will connect to the proxy over the network
  if (process.env.DOCKER_HOST && process.env.DOCKER_HOST.includes('docker-socket-proxy')) {
    return []; // No bind mounts needed - using socket proxy
  }

  // Fallback for local development without proxy
  return ['/var/run/docker.sock:/var/run/docker.sock'];
}
