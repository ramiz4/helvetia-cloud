import Docker from 'dockerode';
import { logger } from 'shared';

/**
 * NetworkManager handles Docker network operations
 * Provides utilities for managing container networks
 */
export class NetworkManager {
  private docker: Docker;

  constructor(docker: Docker) {
    this.docker = docker;
  }

  /**
   * Get a network by ID or name
   */
  getNetwork(id: string): Docker.Network {
    return this.docker.getNetwork(id);
  }

  /**
   * List all networks with optional filters
   */
  async listNetworks(filters?: Record<string, string[]>): Promise<Docker.NetworkInspectInfo[]> {
    return await this.docker.listNetworks({ filters });
  }

  /**
   * Create a new network
   */
  async createNetwork(
    name: string,
    options?: {
      Driver?: string;
      Labels?: Record<string, string>;
      Internal?: boolean;
    },
  ): Promise<Docker.Network> {
    const network = await this.docker.createNetwork({
      Name: name,
      Driver: options?.Driver || 'bridge',
      Labels: options?.Labels,
      Internal: options?.Internal,
    });
    return network;
  }

  /**
   * Remove a network by ID or name
   */
  async removeNetwork(id: string): Promise<void> {
    const network = this.getNetwork(id);
    await network.remove();
  }

  /**
   * Remove networks by label filter
   */
  async removeNetworksByLabel(label: string, value: string): Promise<void> {
    const networks = await this.listNetworks({
      label: [`${label}=${value}`],
    });

    for (const networkInfo of networks) {
      try {
        await this.removeNetwork(networkInfo.Id);
        logger.info(`Removed network ${networkInfo.Name}`);
      } catch (err) {
        logger.error({ err }, `Failed to remove network ${networkInfo.Name}`);
      }
    }
  }

  /**
   * Check if a network exists
   */
  async networkExists(id: string): Promise<boolean> {
    try {
      const network = this.getNetwork(id);
      await network.inspect();
      return true;
    } catch {
      return false;
    }
  }
}
