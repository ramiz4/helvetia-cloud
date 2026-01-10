import Docker from 'dockerode';

/**
 * Container status information
 */
export interface ContainerStatus {
  id: string;
  name: string;
  state: string;
  status: string;
  image: string;
  labels: Record<string, string>;
}

/**
 * Container creation options
 */
export interface CreateContainerOptions {
  name: string;
  image: string;
  env?: Record<string, string>;
  labels?: Record<string, string>;
  exposedPorts?: Record<string, object>;
  hostConfig?: Docker.HostConfig;
}

/**
 * Image build options
 */
export interface BuildImageOptions {
  context: string;
  src: string[];
  tags: string[];
  buildargs?: Record<string, string>;
}

/**
 * Interface for container orchestration operations
 */
export interface IContainerOrchestrator {
  /**
   * List containers with optional filters
   */
  listContainers(options?: {
    all?: boolean;
    filters?: Record<string, string[]>;
  }): Promise<ContainerStatus[]>;

  /**
   * Get container by ID or name
   */
  getContainer(id: string): Promise<Docker.Container>;

  /**
   * Create a new container
   */
  createContainer(options: CreateContainerOptions): Promise<Docker.Container>;

  /**
   * Start a container
   */
  startContainer(container: Docker.Container): Promise<void>;

  /**
   * Stop a container
   */
  stopContainer(container: Docker.Container, timeout?: number): Promise<void>;

  /**
   * Remove a container
   */
  removeContainer(container: Docker.Container, options?: { force?: boolean }): Promise<void>;

  /**
   * Build an image from a context
   */
  buildImage(options: BuildImageOptions): Promise<NodeJS.ReadableStream>;

  /**
   * Pull an image from a registry
   */
  pullImage(imageName: string): Promise<NodeJS.ReadableStream>;

  /**
   * Inspect a container
   */
  inspectContainer(container: Docker.Container): Promise<Docker.ContainerInspectInfo>;

  /**
   * Get container logs
   */
  getContainerLogs(
    container: Docker.Container,
    options?: { stdout?: boolean; stderr?: boolean; tail?: number },
  ): Promise<NodeJS.ReadableStream>;

  /**
   * Get container stats
   */
  getContainerStats(container: Docker.Container): Promise<Docker.ContainerStats>;
}
