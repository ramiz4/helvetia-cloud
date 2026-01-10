/**
 * Job data for deployment queue
 */
export interface DeploymentJobData {
  deploymentId: string;
  serviceId: string;
  repoUrl: string;
  branch: string;
  buildCommand?: string;
  startCommand?: string;
  serviceName: string;
  port: number;
  envVars?: Record<string, string>;
  customDomain?: string;
  type: string;
  staticOutputDir?: string;
}

/**
 * Job options for queue operations
 */
export interface JobOptions {
  attempts?: number;
  backoff?: {
    type: string;
    delay: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

/**
 * Interface for deployment queue operations
 */
export interface IDeploymentQueue {
  /**
   * Add a deployment job to the queue
   */
  add(jobName: string, data: DeploymentJobData, options?: JobOptions): Promise<void>;

  /**
   * Get job by ID
   */
  getJob(jobId: string): Promise<unknown>;

  /**
   * Remove a job from the queue
   */
  removeJob(jobId: string): Promise<void>;

  /**
   * Get queue status
   */
  getStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>;

  /**
   * Close the queue connection
   */
  close(): Promise<void>;
}
