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
 * Mounts the Docker socket (required for builds) and a read-only workspace
 * directory from the host (currently unused — all builds happen in /app).
 * Builds run inside the container's ephemeral filesystem (/app), which is
 * isolated from the host and automatically cleaned up when the container is
 * removed.
 *
 * @returns Array of bind mount strings
 */
export function getSecureBindMounts(): string[] {
  return ['/var/run/docker.sock:/var/run/docker.sock'];
}
