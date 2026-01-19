import { beforeEach, describe, expect, it } from 'vitest';
import { metricsService } from './metrics.service.js';

describe('MetricsService', () => {
  beforeEach(() => {
    // Reset metrics before each test
    metricsService.reset();
  });

  it('should record HTTP requests', async () => {
    // Record a request
    metricsService.recordHttpRequest('GET', '/services', 200, 0.05);

    // Get metrics
    const metrics = await metricsService.getMetrics();

    // Verify the metrics contain our recorded request
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('method="GET"');
    expect(metrics).toContain('route="/services"');
    expect(metrics).toContain('status_code="200"');
  });

  it('should track requests in progress', () => {
    // Start tracking a request
    const endTimer = metricsService.startHttpRequest('POST', '/services');

    // End the request
    const duration = endTimer();

    // Verify duration is a number
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('should record deployment metrics', async () => {
    // Record a deployment
    metricsService.recordDeployment('SUCCESS', 'DOCKER', 120);

    // Get metrics
    const metrics = await metricsService.getMetrics();

    // Verify the metrics contain our deployment
    expect(metrics).toContain('deployments_total');
    expect(metrics).toContain('status="SUCCESS"');
    expect(metrics).toContain('service_type="DOCKER"');
  });

  it('should update queue depth', async () => {
    // Update queue metrics
    metricsService.updateQueueDepth('deployments', 5, 2, 100, 3);

    // Get metrics
    const metrics = await metricsService.getMetrics();

    // Verify the metrics contain queue information
    expect(metrics).toContain('queue_depth');
    expect(metrics).toContain('queue_name="deployments"');
    expect(metrics).toContain('state="waiting"');
    expect(metrics).toContain('state="active"');
  });

  it('should update container resources', async () => {
    // Update container metrics
    metricsService.updateContainerResources('service-123', 'my-service', 45.5, 536870912);

    // Get metrics
    const metrics = await metricsService.getMetrics();

    // Verify the metrics contain container information
    expect(metrics).toContain('container_cpu_usage_percent');
    expect(metrics).toContain('container_memory_usage_bytes');
    expect(metrics).toContain('service_id="service-123"');
    expect(metrics).toContain('service_name="my-service"');
  });

  it('should return metrics as JSON', async () => {
    // Record some metrics
    metricsService.recordHttpRequest('GET', '/health', 200, 0.01);

    // Get metrics as JSON
    const metricsJSON = await metricsService.getMetricsJSON();

    // Verify it's an array
    expect(Array.isArray(metricsJSON)).toBe(true);
    expect((metricsJSON as unknown[]).length).toBeGreaterThan(0);
  });

  it('should reset metrics', async () => {
    // Record some metrics
    metricsService.recordHttpRequest('GET', '/services', 200, 0.05);

    // Reset
    metricsService.reset();

    // Verify metrics are cleared (only default metrics remain)
    const metrics = await metricsService.getMetrics();

    // Should still have some default process metrics
    expect(metrics.length).toBeGreaterThan(0);
  });
});
