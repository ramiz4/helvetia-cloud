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
 * Only mounts the Docker socket - no host directories are exposed.
 * All builds happen inside the container's ephemeral filesystem (/app),
 * which is isolated from the host and automatically cleaned up when
 * the container is removed.
 *
 * @returns Array of bind mount strings
 */
export function getSecureBindMounts(): string[] {
  const workspaceDir = getWorkspaceDir();
  return [
    '/var/run/docker.sock:/var/run/docker.sock',
    `${workspaceDir}:/workspaces:ro`, // Read-only mount for security
  ];
}

/**
 * Clean up old workspace directories
 * @param maxAge Maximum age in milliseconds (default: 24 hours)
 * @returns Promise that resolves when cleanup is complete
 */
export async function cleanupWorkspace(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
  const workspaceDir = getWorkspaceDir();

  try {
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = `${workspaceDir}/${entry.name}`;
        const stats = await fs.stat(dirPath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          await fs.rm(dirPath, { recursive: true, force: true });
        }
      }
    }
  } catch (error) {
    // Gracefully handle non-existent workspace directory
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
