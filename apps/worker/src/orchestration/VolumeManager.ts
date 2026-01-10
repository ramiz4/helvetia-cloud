import Docker from 'dockerode';

/**
 * VolumeManager handles Docker volume operations
 * Provides utilities for creating, listing, and removing volumes
 */
export class VolumeManager {
  private docker: Docker;

  constructor(docker: Docker) {
    this.docker = docker;
  }

  /**
   * Get a volume by name
   */
  getVolume(name: string): Docker.Volume {
    return this.docker.getVolume(name);
  }

  /**
   * List all volumes with optional filters
   */
  async listVolumes(filters?: Record<string, string[]>): Promise<Docker.VolumeInspectInfo[]> {
    const result = await this.docker.listVolumes({ filters });
    return result.Volumes || [];
  }

  /**
   * Remove a volume by name
   */
  async removeVolume(name: string): Promise<void> {
    const volume = this.getVolume(name);
    await volume.remove();
  }

  /**
   * Remove volumes by label filter
   */
  async removeVolumesByLabel(label: string, value: string): Promise<void> {
    const volumes = await this.listVolumes({
      label: [`${label}=${value}`],
    });

    for (const volumeInfo of volumes) {
      try {
        await this.removeVolume(volumeInfo.Name);
        console.log(`Removed volume ${volumeInfo.Name}`);
      } catch (err) {
        console.error(`Failed to remove volume ${volumeInfo.Name}:`, err);
      }
    }
  }

  /**
   * Check if a volume exists
   */
  async volumeExists(name: string): Promise<boolean> {
    try {
      const volume = this.getVolume(name);
      await volume.inspect();
      return true;
    } catch {
      return false;
    }
  }
}
