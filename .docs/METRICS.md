# Observability & Monitoring

Helvetia Cloud includes a built-in observability stack powered by **Prometheus**, **Loki**, and **Grafana** (PLG stack). This provides comprehensive monitoring of both metrics and logs out of the box.

## Monitoring Stack

The following services are automatically started with `docker-compose up -d`:

- **Grafana** ([http://localhost:3010](http://localhost:3010)): Visualization and dashboarding.
  - **Login**: `admin` / `admin`
- **Prometheus** ([http://localhost:9090](http://localhost:9090)): Metrics collection and alerting.
- **Loki** ([http://localhost:3100](http://localhost:3100)): Log aggregation engine.
- **Promtail**: Log agent that scrapes container logs and pushes them to Loki.

## Metrics Endpoints

### API Service

- **URL**: `http://localhost:3001/metrics`
- **Scraped by**: Prometheus via `host.docker.internal:3001` (when running via `pnpm dev`)
- **Format**: Prometheus text format

### Worker Service

- **URL**: `http://localhost:3002/metrics`
- **Scraped by**: Prometheus via `host.docker.internal:3002` (when running via `pnpm dev`)
- **Format**: Prometheus text format

## Available Metrics

### API & Worker Metrics

#### HTTP Request Metrics

- `http_requests_total`: Total number of HTTP requests (labels: `method`, `route`, `status_code`)
- `http_request_duration_seconds`: Request duration buckets.

#### Deployment Metrics

- `deployments_total`: Total deployments (labels: `status`, `service_type`)
- `deployment_duration_seconds`: Processing time buckets.

#### Queue Metrics

- `queue_depth`: Current jobs in queue (labels: `state`)
- `queue_processing_time_seconds`: Time taken to process jobs.

#### Resource Metrics

- `container_cpu_usage_percent`: Real-time CPU usage.
- `container_memory_usage_bytes`: Real-time Memory usage.

## Log Aggregation (Loki)

Container logs are automatically collected by **Promtail**. You can view them in Grafana via the **Explore** tab using the `Loki` data source.

### Example Queries

- **View API logs**: `{container="api"}`
- **View Worker logs**: `{container="worker"}`
- **Filter errors**: `{container="api"} |= "error"`

## Grafana Dashboards

The monitoring stack includes pre-configured dashboards that are automatically provisioned on startup.

### Helvetia Cloud Metrics Dashboard

Accessible via **Dashboards -> Browse -> Helvetia**. It provides:

- **Request Rate**: RPS over time.
- **Error Rate**: 4xx/5xx errors.
- **Latency**: P95 response times.
- **Worker Load**: Active jobs and queue depth.
- **Resources**: CPU and Memory trends.

## Configuration

Monitoring configuration is stored in the `monitoring/` directory:

- `prometheus.yml`: Scrape targets and intervals.
- `promtail-config.yml`: Docker log scraping rules.
- `grafana/provisioning/`: Automatic setup of data sources and dashboards.

## Troubleshooting

### Metrics not appearing in Grafana

1. Verify the service is running: `curl http://localhost:3001/metrics`
2. Check Prometheus targets: [http://localhost:9090/targets](http://localhost:9090/targets)
3. Ensure the service is accessible to the Docker network via `host.docker.internal`.

### Logs missing in Loki

1. Check Promtail logs: `docker logs helvetia-cloud-promtail-1`
2. Verify Docker log paths in `docker-compose.yml` are accessible to the Promtail container.
3. On macOS/Windows, ensure the Docker Desktop has permission to access the container log directory.

## Further Reading

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
