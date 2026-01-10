import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Metrics Service
 *
 * Provides Prometheus metrics for monitoring:
 * - HTTP request rates, latencies, and error rates
 * - Deployment success/failure rates
 * - Queue depths and processing times
 * - Resource usage (CPU, memory)
 */
class MetricsService {
  public readonly register: Registry;

  // HTTP Metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestsInProgress: Gauge;

  // Deployment Metrics
  public readonly deploymentsTotal: Counter;
  public readonly deploymentDuration: Histogram;

  // Queue Metrics
  public readonly queueDepth: Gauge;
  public readonly queueProcessingTime: Histogram;

  // Resource Metrics
  public readonly containerCpuUsage: Gauge;
  public readonly containerMemoryUsage: Gauge;

  // Service Metrics
  public readonly activeServices: Gauge;
  public readonly servicesStatus: Gauge;

  constructor() {
    this.register = new Registry();

    // Collect default metrics (Node.js process metrics)
    collectDefaultMetrics({ register: this.register });

    // HTTP Request Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.register],
    });

    this.httpRequestsInProgress = new Gauge({
      name: 'http_requests_in_progress',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['method', 'route'],
      registers: [this.register],
    });

    // Deployment Metrics
    this.deploymentsTotal = new Counter({
      name: 'deployments_total',
      help: 'Total number of deployments',
      labelNames: ['status', 'service_type'],
      registers: [this.register],
    });

    this.deploymentDuration = new Histogram({
      name: 'deployment_duration_seconds',
      help: 'Deployment duration in seconds',
      labelNames: ['status', 'service_type'],
      buckets: [10, 30, 60, 120, 300, 600, 1200, 1800, 3600],
      registers: [this.register],
    });

    // Queue Metrics
    this.queueDepth = new Gauge({
      name: 'queue_depth',
      help: 'Number of jobs waiting in the queue',
      labelNames: ['queue_name', 'state'],
      registers: [this.register],
    });

    this.queueProcessingTime = new Histogram({
      name: 'queue_processing_time_seconds',
      help: 'Time taken to process queue jobs',
      labelNames: ['queue_name', 'job_name'],
      buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1200, 1800],
      registers: [this.register],
    });

    // Resource Metrics
    this.containerCpuUsage = new Gauge({
      name: 'container_cpu_usage_percent',
      help: 'Container CPU usage percentage',
      labelNames: ['service_id', 'service_name'],
      registers: [this.register],
    });

    this.containerMemoryUsage = new Gauge({
      name: 'container_memory_usage_bytes',
      help: 'Container memory usage in bytes',
      labelNames: ['service_id', 'service_name'],
      registers: [this.register],
    });

    // Service Metrics
    this.activeServices = new Gauge({
      name: 'active_services_total',
      help: 'Total number of active services',
      labelNames: ['user_id'],
      registers: [this.register],
    });

    this.servicesStatus = new Gauge({
      name: 'services_by_status',
      help: 'Number of services by status',
      labelNames: ['status'],
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
   * Record HTTP request
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  /**
   * Start tracking an HTTP request
   */
  startHttpRequest(method: string, route: string): () => void {
    this.httpRequestsInProgress.inc({ method, route });
    const startTime = Date.now();

    return () => {
      this.httpRequestsInProgress.dec({ method, route });
      return (Date.now() - startTime) / 1000;
    };
  }

  /**
   * Record deployment completion
   */
  recordDeployment(status: string, serviceType: string, duration: number): void {
    this.deploymentsTotal.inc({ status, service_type: serviceType });
    this.deploymentDuration.observe({ status, service_type: serviceType }, duration);
  }

  /**
   * Update queue depth metrics
   */
  updateQueueDepth(
    queueName: string,
    waiting: number,
    active: number,
    completed: number,
    failed: number,
  ): void {
    this.queueDepth.set({ queue_name: queueName, state: 'waiting' }, waiting);
    this.queueDepth.set({ queue_name: queueName, state: 'active' }, active);
    this.queueDepth.set({ queue_name: queueName, state: 'completed' }, completed);
    this.queueDepth.set({ queue_name: queueName, state: 'failed' }, failed);
  }

  /**
   * Record queue job processing time
   */
  recordQueueProcessing(queueName: string, jobName: string, duration: number): void {
    this.queueProcessingTime.observe({ queue_name: queueName, job_name: jobName }, duration);
  }

  /**
   * Update container resource metrics
   */
  updateContainerResources(
    serviceId: string,
    serviceName: string,
    cpuPercent: number,
    memoryBytes: number,
  ): void {
    this.containerCpuUsage.set({ service_id: serviceId, service_name: serviceName }, cpuPercent);
    this.containerMemoryUsage.set(
      { service_id: serviceId, service_name: serviceName },
      memoryBytes,
    );
  }

  /**
   * Update service count metrics
   */
  updateServiceMetrics(userId: string, activeCount: number): void {
    this.activeServices.set({ user_id: userId }, activeCount);
  }

  /**
   * Update services by status
   */
  updateServicesStatus(statusCounts: Record<string, number>): void {
    Object.entries(statusCounts).forEach(([status, count]) => {
      this.servicesStatus.set({ status }, count);
    });
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.register.resetMetrics();
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
