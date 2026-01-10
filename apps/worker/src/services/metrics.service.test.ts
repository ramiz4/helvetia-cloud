import { beforeEach, describe, expect, it } from 'vitest';
import { workerMetricsService } from './metrics.service';

describe('WorkerMetricsService', () => {
  beforeEach(() => {
    // Reset metrics before each test
    workerMetricsService.reset();
  });

  it('should record deployment metrics', async () => {
    // Record a deployment
    workerMetricsService.recordDeployment('SUCCESS', 'DOCKER', 120);

    // Get metrics
    const metrics = await workerMetricsService.getMetrics();

    // Verify the metrics contain our deployment
    expect(metrics).toContain('worker_deployments_total');
    expect(metrics).toContain('status="SUCCESS"');
    expect(metrics).toContain('service_type="DOCKER"');
  });

  it('should record job processing', async () => {
    // Record a job
    workerMetricsService.recordJobProcessing('build', 'completed', 60);

    // Get metrics
    const metrics = await workerMetricsService.getMetrics();

    // Verify the metrics contain job information
    expect(metrics).toContain('worker_jobs_processed_total');
    expect(metrics).toContain('job_name="build"');
    expect(metrics).toContain('status="completed"');
  });

  it('should track active jobs', async () => {
    // Increment active jobs
    workerMetricsService.incrementActiveJobs('build');
    workerMetricsService.incrementActiveJobs('build');

    // Get metrics
    let metrics = await workerMetricsService.getMetrics();

    // Should show 2 active jobs
    expect(metrics).toContain('worker_active_jobs');
    expect(metrics).toContain('job_name="build"');

    // Decrement
    workerMetricsService.decrementActiveJobs('build');
    workerMetricsService.decrementActiveJobs('build');

    // Get updated metrics
    metrics = await workerMetricsService.getMetrics();

    // Should show 0 active jobs
    expect(metrics).toContain('worker_active_jobs');
  });

  it('should return metrics as JSON', async () => {
    // Record some metrics
    workerMetricsService.recordDeployment('SUCCESS', 'STATIC', 30);

    // Get metrics as JSON
    const metricsJSON = await workerMetricsService.getMetricsJSON();

    // Verify it's an array
    expect(Array.isArray(metricsJSON)).toBe(true);
    expect((metricsJSON as any[]).length).toBeGreaterThan(0);
  });

  it('should reset metrics', async () => {
    // Record some metrics
    workerMetricsService.recordDeployment('FAILED', 'DOCKER', 45);

    // Reset
    workerMetricsService.reset();

    // Verify metrics are cleared (only default metrics remain)
    const metrics = await workerMetricsService.getMetrics();

    // Should still have some default process metrics
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('should handle multiple service types', async () => {
    // Record deployments for different service types
    workerMetricsService.recordDeployment('SUCCESS', 'DOCKER', 100);
    workerMetricsService.recordDeployment('SUCCESS', 'STATIC', 30);
    workerMetricsService.recordDeployment('FAILED', 'COMPOSE', 200);

    // Get metrics
    const metrics = await workerMetricsService.getMetrics();

    // Verify all service types are recorded
    expect(metrics).toContain('service_type="DOCKER"');
    expect(metrics).toContain('service_type="STATIC"');
    expect(metrics).toContain('service_type="COMPOSE"');
  });
});
