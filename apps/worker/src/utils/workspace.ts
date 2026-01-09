import fs from 'fs/promises';
import path from 'path';

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
 * Clean up old workspace directories
 * @param maxAgeMs Maximum age in milliseconds (default: 24 hours)
 */
export async function cleanupWorkspace(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
  const workspaceDir = getWorkspaceDir();

  try {
    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(workspaceDir, entry.name);
        try {
          const stats = await fs.stat(dirPath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await fs.rm(dirPath, { recursive: true, force: true });
            console.log(`Cleaned up old workspace: ${entry.name}`);
          }
        } catch (error) {
          console.error(`Error cleaning up ${entry.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error during workspace cleanup:', error);
  }
}

/**
 * Get secure Docker bind mounts for builder containers
 * @returns Array of bind mount strings
 */
export function getSecureBindMounts(): string[] {
  const workspaceDir = getWorkspaceDir();
  return [
    '/var/run/docker.sock:/var/run/docker.sock',
    `${workspaceDir}:/workspaces:ro`, // Read-only mount for security
  ];
}
