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
 * Clean up old workspace directories that exceed the specified age.
 * This function is safe to call periodically (e.g., via cron job or at startup).
 *
 * Cleanup behavior:
 * - Scans the workspace directory for subdirectories
 * - Compares modification time of each directory against maxAgeMs
 * - Removes directories older than the threshold
 * - Logs cleanup actions and errors without throwing
 *
 * Error handling:
 * - Non-existent workspace directory: silently ignored
 * - Individual directory errors: logged but don't stop cleanup of other directories
 * - This ensures cleanup is resilient and doesn't break the application
 *
 * @param maxAgeMs Maximum age in milliseconds before a workspace is cleaned up (default: 24 hours)
 * @returns Promise that resolves when cleanup is complete
 *
 * @example
 * // Clean up workspaces older than 24 hours (default)
 * await cleanupWorkspace();
 *
 * @example
 * // Clean up workspaces older than 1 hour
 * await cleanupWorkspace(60 * 60 * 1000);
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
