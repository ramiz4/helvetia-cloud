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
