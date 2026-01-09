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
  return ['/var/run/docker.sock:/var/run/docker.sock'];
}
