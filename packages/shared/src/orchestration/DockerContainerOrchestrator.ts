import Docker from 'dockerode';
import {
  BuildImageOptions,
  ContainerStatus,
  CreateContainerOptions,
  IContainerOrchestrator,
} from './IContainerOrchestrator';

/**
 * Docker implementation of the IContainerOrchestrator interface.
 * Provides a clean abstraction over Docker container operations.
 *
 * NOTE ON DEPENDENCY INJECTION:
 * This shared implementation intentionally does not use framework-specific
 * dependency injection decorators (e.g. `@injectable`, `@inject`) to avoid
 * coupling the shared package to a particular DI library.
 *
 * Applications (e.g. API, Worker) are expected to integrate this class with
 * their DI containers explicitly (for example, via `registerInstance` or
 * equivalent registration APIs). This preserves the existing architecture
 * while keeping the shared package independent of any DI framework.
 */
export class DockerContainerOrchestrator implements IContainerOrchestrator {
  private docker: Docker;

  /**
   * Optionally accepts a pre-configured Docker client, which can be provided
   * by the application's DI container. If none is provided, a new Docker
   * client instance is created.
   */
  constructor(docker?: Docker) {
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
      name: container.Names?.[0]?.replace(/^\//, '') || '',
      state: container.State || 'unknown',
      status: container.Status || '',
      image: container.Image || '',
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
    )) as unknown as NodeJS.ReadableStream;
  }

  /**
   * Pull an image from a registry
   */
  async pullImage(imageName: string): Promise<NodeJS.ReadableStream> {
    return (await this.docker.pull(imageName)) as unknown as NodeJS.ReadableStream;
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
    })) as unknown as NodeJS.ReadableStream;
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
