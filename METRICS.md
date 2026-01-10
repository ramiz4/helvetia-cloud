# Prometheus Metrics Documentation

This document describes the Prometheus metrics exposed by Helvetia Cloud services for monitoring and alerting.

## Metrics Endpoints

### API Service

- **URL**: `http://localhost:3001/metrics` (production: `https://api.helvetia.cloud/metrics`)
- **Format**: Prometheus text format
- **Authentication**: Public (no authentication required)

### Worker Service

- **URL**: `http://localhost:3002/metrics` (production: `https://worker.helvetia.cloud:3002/metrics`)
- **Format**: Prometheus text format
- **Authentication**: Public (no authentication required)

### JSON Format (for debugging)

Both services also expose a JSON endpoint for easier debugging:

- API: `http://localhost:3001/metrics/json`
- Worker: `http://localhost:3002/metrics/json`

## Available Metrics

### API Service Metrics

#### HTTP Request Metrics

**`http_requests_total`** (Counter)

- Total number of HTTP requests
- Labels:
  - `method`: HTTP method (GET, POST, PATCH, DELETE)
  - `route`: Route path (e.g., `/services`, `/auth/github`)
  - `status_code`: HTTP status code (200, 404, 500, etc.)

**`http_request_duration_seconds`** (Histogram)

- HTTP request duration in seconds
- Labels: `method`, `route`, `status_code`
- Buckets: 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10 seconds

**`http_requests_in_progress`** (Gauge)

- Number of HTTP requests currently being processed
- Labels: `method`, `route`

#### Deployment Metrics

**`deployments_total`** (Counter)

- Total number of deployments
- Labels:
  - `status`: SUCCESS, FAILED
  - `service_type`: DOCKER, STATIC, COMPOSE, POSTGRES, REDIS, MYSQL

**`deployment_duration_seconds`** (Histogram)

- Deployment duration in seconds
- Labels: `status`, `service_type`
- Buckets: 10, 30, 60, 120, 300, 600, 1200, 1800, 3600 seconds

#### Queue Metrics

**`queue_depth`** (Gauge)

- Number of jobs in the queue by state
- Labels:
  - `queue_name`: Name of the queue (e.g., `deployments`)
  - `state`: waiting, active, completed, failed

**`queue_processing_time_seconds`** (Histogram)

- Time taken to process queue jobs
- Labels: `queue_name`, `job_name`
- Buckets: 1, 5, 10, 30, 60, 120, 300, 600, 1200, 1800 seconds

#### Resource Metrics

**`container_cpu_usage_percent`** (Gauge)

- Container CPU usage percentage
- Labels:
  - `service_id`: Service ID
  - `service_name`: Service name

**`container_memory_usage_bytes`** (Gauge)

- Container memory usage in bytes
- Labels: `service_id`, `service_name`

#### Service Metrics

**`active_services_total`** (Gauge)

- Total number of active services per user
- Labels: `user_id`

**`services_by_status`** (Gauge)

- Number of services by status
- Labels: `status` (RUNNING, STOPPED, DEPLOYING, FAILED, etc.)

### Worker Service Metrics

#### Deployment Metrics

**`worker_deployments_total`** (Counter)

- Total number of deployments processed by the worker
- Labels: `status`, `service_type`

**`worker_deployment_duration_seconds`** (Histogram)

- Deployment processing duration in seconds
- Labels: `status`, `service_type`
- Buckets: 10, 30, 60, 120, 300, 600, 1200, 1800, 3600 seconds

#### Job Metrics

**`worker_jobs_processed_total`** (Counter)

- Total number of jobs processed
- Labels:
  - `job_name`: Name of the job (e.g., `build`)
  - `status`: completed, failed

**`worker_job_processing_time_seconds`** (Histogram)

- Time taken to process jobs
- Labels: `job_name`
- Buckets: 1, 5, 10, 30, 60, 120, 300, 600, 1200, 1800 seconds

**`worker_active_jobs`** (Gauge)

- Number of jobs currently being processed
- Labels: `job_name`

### Default Node.js Metrics

Both services also expose default Node.js process metrics:

- `process_cpu_user_seconds_total`: Total user CPU time
- `process_cpu_system_seconds_total`: Total system CPU time
- `process_cpu_seconds_total`: Total CPU time
- `process_start_time_seconds`: Start time of the process
- `process_resident_memory_bytes`: Resident memory size
- `process_virtual_memory_bytes`: Virtual memory size
- `process_heap_bytes`: Process heap size
- `nodejs_eventloop_lag_seconds`: Event loop lag
- `nodejs_active_handles_total`: Number of active handles
- `nodejs_active_requests_total`: Number of active requests
- `nodejs_heap_size_total_bytes`: Total heap size
- `nodejs_heap_size_used_bytes`: Used heap size
- `nodejs_external_memory_bytes`: External memory
- `nodejs_version_info`: Node.js version information

## Prometheus Configuration

### Scrape Configuration

Add the following to your `prometheus.yml`:

```yaml
scrape_configs:
  # API Service
  - job_name: 'helvetia-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'

  # Worker Service
  - job_name: 'helvetia-worker'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3002']
    metrics_path: '/metrics'
```

### Example Queries

#### Request Rate

```promql
# Requests per second
rate(http_requests_total[5m])

# Requests per second by route
sum(rate(http_requests_total[5m])) by (route)
```

#### Error Rate

```promql
# Error rate (4xx and 5xx)
sum(rate(http_requests_total{status_code=~"4..|5.."}[5m])) by (route)

# Error percentage
sum(rate(http_requests_total{status_code=~"4..|5.."}[5m]))
/
sum(rate(http_requests_total[5m])) * 100
```

#### Latency

```promql
# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 99th percentile latency by route
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (route, le))
```

#### Deployment Metrics

```promql
# Deployment success rate
sum(rate(deployments_total{status="SUCCESS"}[5m]))
/
sum(rate(deployments_total[5m])) * 100

# Failed deployments per minute
rate(deployments_total{status="FAILED"}[1m]) * 60

# Deployment duration by service type
histogram_quantile(0.95, sum(rate(deployment_duration_seconds_bucket[5m])) by (service_type, le))
```

#### Queue Metrics

```promql
# Current queue depth
queue_depth{state="waiting"}

# Jobs in progress
queue_depth{state="active"}

# Failed jobs rate
rate(queue_depth{state="failed"}[5m])
```

#### Resource Usage

```promql
# CPU usage by service
container_cpu_usage_percent

# Memory usage by service (in MB)
container_memory_usage_bytes / 1024 / 1024

# Top 5 services by memory usage
topk(5, container_memory_usage_bytes)
```

## Alerting Rules

### Example Alert Rules

Create a file `alerts.yml`:

```yaml
groups:
  - name: helvetia_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (route)
          / 
          sum(rate(http_requests_total[5m])) by (route) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High error rate on {{ $labels.route }}'
          description: 'Error rate is {{ $value | humanizePercentage }} on route {{ $labels.route }}'

      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, 
            sum(rate(http_request_duration_seconds_bucket[5m])) by (route, le)
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High latency on {{ $labels.route }}'
          description: '95th percentile latency is {{ $value }}s on route {{ $labels.route }}'

      # Deployment failures
      - alert: DeploymentFailures
        expr: |
          sum(rate(deployments_total{status="FAILED"}[5m])) by (service_type) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High deployment failure rate for {{ $labels.service_type }}'
          description: 'Deployment failure rate is {{ $value }} per second'

      # Queue backing up
      - alert: QueueBacklog
        expr: queue_depth{state="waiting"} > 50
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'Queue {{ $labels.queue_name }} has a backlog'
          description: '{{ $labels.queue_name }} has {{ $value }} jobs waiting'

      # High memory usage
      - alert: HighMemoryUsage
        expr: |
          container_memory_usage_bytes / 1024 / 1024 / 1024 > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High memory usage on {{ $labels.service_name }}'
          description: 'Memory usage is {{ $value | humanize }}GB on {{ $labels.service_name }}'

      # Service down
      - alert: ServiceDown
        expr: up{job="helvetia-api"} == 0 or up{job="helvetia-worker"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Service {{ $labels.job }} is down'
          description: '{{ $labels.job }} has been down for more than 1 minute'
```

## Grafana Dashboard

### Import Dashboard

1. Open Grafana
2. Navigate to Dashboards → Import
3. Upload the dashboard JSON file (see `grafana-dashboard.json` in this directory)

### Dashboard Panels

The included dashboard provides:

- **Request Rate**: Requests per second over time
- **Error Rate**: 4xx and 5xx errors per second
- **Latency**: P50, P95, P99 latencies
- **Deployment Success Rate**: Success vs failure rate
- **Queue Depth**: Jobs in queue by state
- **Resource Usage**: CPU and memory usage by service
- **Active Services**: Number of services by status

## Monitoring Best Practices

1. **Set appropriate scrape intervals**: 15-30 seconds is typically sufficient
2. **Use recording rules**: Pre-compute expensive queries for better performance
3. **Set up alerts**: Configure alerts for critical metrics (error rate, latency, deployment failures)
4. **Monitor trends**: Track metrics over time to identify patterns and anomalies
5. **Use labels wisely**: Don't create too many unique label combinations (high cardinality)
6. **Test alerts**: Regularly test your alert rules to ensure they fire correctly

## Troubleshooting

### Metrics not appearing

1. Check service is running: `curl http://localhost:3001/health`
2. Check metrics endpoint: `curl http://localhost:3001/metrics`
3. Verify Prometheus can reach the endpoint
4. Check Prometheus logs for scrape errors

### High cardinality warnings

If you see high cardinality warnings:

- Avoid using user IDs or other high-cardinality values in labels
- Consider aggregating metrics at query time instead
- Use recording rules to pre-aggregate metrics

### Missing data points

- Verify scrape interval matches data retention
- Check for network issues between Prometheus and services
- Ensure services haven't been restarted (gauge metrics reset on restart)

## Further Reading

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node.js Client for Prometheus](https://github.com/siimon/prom-client)
