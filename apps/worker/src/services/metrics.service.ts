import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Worker Metrics Service
 *
 * Provides Prometheus metrics for worker monitoring:
 * - Deployment success/failure rates
 * - Queue processing times
 * - Resource usage
 */
class WorkerMetricsService {
  public readonly register: Registry;

  // Deployment Metrics
  public readonly deploymentsTotal: Counter;
  public readonly deploymentDuration: Histogram;

  // Queue Metrics
  public readonly jobsProcessed: Counter;
  public readonly jobProcessingTime: Histogram;
  public readonly activeJobs: Gauge;

  constructor() {
    this.register = new Registry();

    // Collect default metrics (Node.js process metrics)
    collectDefaultMetrics({ register: this.register, prefix: 'worker_' });

    // Deployment Metrics
    this.deploymentsTotal = new Counter({
      name: 'worker_deployments_total',
      help: 'Total number of deployments processed',
      labelNames: ['status', 'service_type'],
      registers: [this.register],
    });

    this.deploymentDuration = new Histogram({
      name: 'worker_deployment_duration_seconds',
      help: 'Deployment processing duration in seconds',
      labelNames: ['status', 'service_type'],
      buckets: [10, 30, 60, 120, 300, 600, 1200, 1800, 3600],
      registers: [this.register],
    });

    // Queue Metrics
    this.jobsProcessed = new Counter({
      name: 'worker_jobs_processed_total',
      help: 'Total number of jobs processed',
      labelNames: ['job_name', 'status'],
      registers: [this.register],
    });

    this.jobProcessingTime = new Histogram({
      name: 'worker_job_processing_time_seconds',
      help: 'Time taken to process jobs',
      labelNames: ['job_name'],
      buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200, 1800],
      registers: [this.register],
    });

    this.activeJobs = new Gauge({
      name: 'worker_active_jobs',
      help: 'Number of jobs currently being processed',
      labelNames: ['job_name'],
      registers: [this.register],
    });
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get metrics as JSON for debugging
   */
  async getMetricsJSON(): Promise<object> {
    return this.register.getMetricsAsJSON();
  }

  /**
   * Record deployment completion
   */
  recordDeployment(status: string, serviceType: string, duration: number): void {
    this.deploymentsTotal.inc({ status, service_type: serviceType });
    this.deploymentDuration.observe({ status, service_type: serviceType }, duration);
  }

  /**
   * Record job processing
   */
  recordJobProcessing(jobName: string, status: string, duration: number): void {
    this.jobsProcessed.inc({ job_name: jobName, status });
    this.jobProcessingTime.observe({ job_name: jobName }, duration);
  }

  /**
   * Track active jobs
   */
  incrementActiveJobs(jobName: string): void {
    this.activeJobs.inc({ job_name: jobName });
  }

  /**
   * Decrement active jobs
   */
  decrementActiveJobs(jobName: string): void {
    this.activeJobs.dec({ job_name: jobName });
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.register.resetMetrics();
  }
}

// Export singleton instance
export const workerMetricsService = new WorkerMetricsService();
