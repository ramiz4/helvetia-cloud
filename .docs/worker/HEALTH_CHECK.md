# Worker Health Check Endpoint

## Overview

The worker service exposes an HTTP health check endpoint for monitoring and operational purposes. This endpoint provides comprehensive information about the worker's health status, queue statistics, Redis connectivity, and uptime.

## Endpoint

```
GET /health
```

**Port:** 3002 (default, configurable via `WORKER_HEALTH_PORT`)

## Response Format

### Healthy Response (200 OK)

```json
{
  "status": "healthy",
  "uptime": 3600,
  "redis": {
    "connected": true,
    "status": "ready"
  },
  "queue": {
    "name": "deployments",
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 3
  },
  "timestamp": "2024-01-10T12:00:00.000Z"
}
```

### Unhealthy Response (503 Service Unavailable)

```json
{
  "status": "unhealthy",
  "uptime": 3600,
  "redis": {
    "connected": false,
    "status": "disconnected"
  },
  "queue": {
    "name": "deployments",
    "waiting": 0,
    "active": 0,
    "completed": 0,
    "failed": 0
  },
  "timestamp": "2024-01-10T12:00:00.000Z"
}
```

### Error Response (503 Service Unavailable)

```json
{
  "status": "unhealthy",
  "error": "Health check failed",
  "timestamp": "2024-01-10T12:00:00.000Z"
}
```

## Response Fields

| Field             | Type    | Description                                                                 |
| ----------------- | ------- | --------------------------------------------------------------------------- |
| `status`          | string  | Overall health status: `"healthy"` or `"unhealthy"`                         |
| `uptime`          | number  | Worker uptime in seconds since startup                                      |
| `redis.connected` | boolean | Whether Redis connection is active                                          |
| `redis.status`    | string  | Redis connection status (e.g., `"ready"`, `"connecting"`, `"disconnected"`) |
| `queue.name`      | string  | Name of the deployment queue (always `"deployments"`)                       |
| `queue.waiting`   | number  | Number of jobs waiting in the queue                                         |
| `queue.active`    | number  | Number of jobs currently being processed                                    |
| `queue.completed` | number  | Total number of completed jobs                                              |
| `queue.failed`    | number  | Total number of failed jobs                                                 |
| `timestamp`       | string  | ISO 8601 timestamp of the health check                                      |

## Health Status Determination

The worker is considered **healthy** when:

- Redis connection is active (`connected: true`)
- The service can successfully retrieve queue statistics

The worker is considered **unhealthy** when:

- Redis connection is down or unavailable
- Unable to communicate with the queue system

## Configuration

### Environment Variables

| Variable             | Default                  | Description                           |
| -------------------- | ------------------------ | ------------------------------------- |
| `WORKER_HEALTH_PORT` | `3002`                   | Port for the health check HTTP server |
| `REDIS_URL`          | `redis://localhost:6379` | Redis connection URL                  |

### Example Configuration

```bash
# .env
WORKER_HEALTH_PORT=3002
REDIS_URL=redis://localhost:6379
```

## Usage Examples

### cURL

```bash
# Check worker health
curl http://localhost:3002/health

# Check with verbose output
curl -v http://localhost:3002/health
```

### Docker Health Check

Add to your `docker-compose.yml`:

```yaml
services:
  worker:
    image: worker:latest
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3002/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Kubernetes Liveness/Readiness Probes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: worker
spec:
  containers:
    - name: worker
      image: worker:latest
      livenessProbe:
        httpGet:
          path: /health
          port: 3002
        initialDelaySeconds: 30
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /health
          port: 3002
        initialDelaySeconds: 10
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 3
```

### Monitoring with Prometheus

Example Prometheus configuration:

```yaml
scrape_configs:
  - job_name: 'worker-health'
    metrics_path: '/health'
    static_configs:
      - targets: ['localhost:3002']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
```

### Node.js/TypeScript Client

```typescript
import axios from 'axios';

async function checkWorkerHealth() {
  try {
    const response = await axios.get('http://localhost:3002/health');

    if (response.data.status === 'healthy') {
      console.log('Worker is healthy');
      console.log(`Uptime: ${response.data.uptime}s`);
      console.log(`Active jobs: ${response.data.queue.active}`);
      console.log(`Waiting jobs: ${response.data.queue.waiting}`);
    } else {
      console.error('Worker is unhealthy');
    }
  } catch (error) {
    console.error('Failed to check worker health:', error);
  }
}

// Check health every 30 seconds
setInterval(checkWorkerHealth, 30000);
```

## Integration with Load Balancers

### Traefik

```yaml
http:
  services:
    worker:
      loadBalancer:
        servers:
          - url: 'http://worker:3002'
        healthCheck:
          path: '/health'
          interval: '30s'
          timeout: '10s'
```

### NGINX

```nginx
upstream worker_backend {
    server worker:3002 max_fails=3 fail_timeout=30s;

    # Health check configuration
    check interval=30000 rise=2 fall=3 timeout=10000 type=http;
    check_http_send "GET /health HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx;
}
```

## Monitoring Best Practices

1. **Set up alerts**: Configure alerts for when the worker status is unhealthy for extended periods
2. **Track queue depth**: Monitor `waiting` and `failed` job counts to detect bottlenecks
3. **Monitor uptime**: Track worker restarts and downtime
4. **Log health check failures**: Ensure health check errors are logged for debugging
5. **Regular testing**: Periodically test the health endpoint in your CI/CD pipeline

## Troubleshooting

### Common Issues

#### Redis Connection Failed

**Symptom:** `redis.connected: false`

**Solutions:**

- Verify Redis is running: `redis-cli ping`
- Check Redis URL configuration in environment variables
- Ensure network connectivity between worker and Redis
- Check Redis authentication credentials

#### Queue Statistics Showing Zero

**Symptom:** All queue counts are 0

**Possible causes:**

- No deployments have been triggered yet (normal for new installations)
- Queue was recently cleared
- Redis connection issue preventing stat retrieval

#### Health Check Endpoint Not Responding

**Symptom:** Connection timeout or refused

**Solutions:**

- Verify worker service is running
- Check that port 3002 (or configured port) is accessible
- Ensure firewall rules allow traffic on the health check port
- Check worker logs for startup errors

## Security Considerations

1. **No Authentication**: The health endpoint does not require authentication by design for monitoring tools
2. **Network Isolation**: Consider restricting access to the health endpoint to your monitoring network
3. **Information Disclosure**: The endpoint reveals queue statistics which could be considered sensitive
4. **Rate Limiting**: Consider implementing rate limiting if the endpoint is exposed publicly

## Related Documentation

- [Worker Service Architecture](../ARCHITECTURE.md)
- [Docker Compose Setup](../../docker-compose.yml)
- [Environment Configuration](../../.env.example)
