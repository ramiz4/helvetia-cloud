import Docker from 'dockerode';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import {
  BuildImageOptions,
  ContainerStatus,
  CreateContainerOptions,
  IContainerOrchestrator,
} from '../interfaces/IContainerOrchestrator';

/**
 * Docker implementation of the IContainerOrchestrator interface
 * Provides a clean abstraction over Docker container operations
 */
@injectable()
export class DockerContainerOrchestrator implements IContainerOrchestrator {
  private docker: Docker;

  constructor(@inject(TOKENS.Docker) docker?: Docker) {
    this.docker = docker || new Docker();
  }

  /**
   * List containers with optional filters
   */
  async listContainers(options?: {
    all?: boolean;
    filters?: Record<string, string[]>;
  }): Promise<ContainerStatus[]> {
    const containers = await this.docker.listContainers(options);

    return containers.map((container) => ({
      id: container.Id,
      name: container.Names[0]?.replace(/^\//, '') || '',
      state: container.State,
      status: container.Status,
      image: container.Image,
      labels: container.Labels || {},
    }));
  }

  /**
   * Get container by ID or name
   */
  async getContainer(id: string): Promise<Docker.Container> {
    return this.docker.getContainer(id);
  }

  /**
   * Create a new container
   */
  async createContainer(options: CreateContainerOptions): Promise<Docker.Container> {
    const createOptions: Docker.ContainerCreateOptions = {
      name: options.name,
      Image: options.image,
      Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
      Labels: options.labels,
      ExposedPorts: options.exposedPorts,
      HostConfig: options.hostConfig,
    };

    return await this.docker.createContainer(createOptions);
  }

  /**
   * Start a container
   */
  async startContainer(container: Docker.Container): Promise<void> {
    await container.start();
  }

  /**
   * Stop a container
   */
  async stopContainer(container: Docker.Container, timeout?: number): Promise<void> {
    await container.stop({ t: timeout });
  }

  /**
   * Remove a container
   */
  async removeContainer(container: Docker.Container, options?: { force?: boolean }): Promise<void> {
    await container.remove(options);
  }

  /**
   * Build an image from a context
   */
  async buildImage(options: BuildImageOptions): Promise<NodeJS.ReadableStream> {
    return (await this.docker.buildImage(
      {
        context: options.context,
        src: options.src,
      },
      {
        t: options.tags.join(','),
        buildargs: options.buildargs,
      },
    )) as any as NodeJS.ReadableStream;
  }

  /**
   * Pull an image from a registry
   */
  async pullImage(imageName: string): Promise<NodeJS.ReadableStream> {
    return (await this.docker.pull(imageName)) as any as NodeJS.ReadableStream;
  }

  /**
   * Inspect a container
   */
  async inspectContainer(container: Docker.Container): Promise<Docker.ContainerInspectInfo> {
    return await container.inspect();
  }

  /**
   * Get container logs
   */
  async getContainerLogs(
    container: Docker.Container,
    options?: { stdout?: boolean; stderr?: boolean; tail?: number },
  ): Promise<NodeJS.ReadableStream> {
    return (await container.logs({
      stdout: options?.stdout ?? true,
      stderr: options?.stderr ?? true,
      tail: options?.tail,
    })) as any as NodeJS.ReadableStream;
  }

  /**
   * Get container stats
   */
  async getContainerStats(container: Docker.Container): Promise<Docker.ContainerStats> {
    return await container.stats({ stream: false });
  }

  /**
   * Get the underlying Docker instance
   * Useful for advanced operations not covered by the interface
   */
  getDockerInstance(): Docker {
    return this.docker;
  }
}
