# Worker Monitoring Setup Guide

This guide provides step-by-step instructions for setting up monitoring for the Helvetia Cloud worker service using various tools and platforms.

## Table of Contents

1. [Docker Compose Health Checks](#docker-compose-health-checks)
2. [Kubernetes Monitoring](#kubernetes-monitoring)
3. [Prometheus & Grafana](#prometheus--grafana)
4. [Uptime Monitoring Services](#uptime-monitoring-services)
5. [Custom Monitoring Scripts](#custom-monitoring-scripts)
6. [Alerting Configuration](#alerting-configuration)

---

## Docker Compose Health Checks

### Basic Setup

Add health check configuration to your `docker-compose.yml`:

```yaml
services:
  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile.dev
    environment:
      - WORKER_HEALTH_PORT=3003
      - REDIS_URL=redis://redis:6379
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3003/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - helvetia-net

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
```

### Verify Health Status

```bash
# Check service health status
docker-compose ps

# View health check logs
docker-compose logs worker

# Manually test health endpoint
curl http://localhost:3003/health
```

---

## Kubernetes Monitoring

### Deployment with Probes

Create a Kubernetes deployment with liveness and readiness probes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
  labels:
    app: helvetia-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: helvetia-worker
  template:
    metadata:
      labels:
        app: helvetia-worker
    spec:
      containers:
        - name: worker
          image: helvetia-worker:latest
          ports:
            - containerPort: 3003
              name: health
          env:
            - name: WORKER_HEALTH_PORT
              value: '3003'
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: helvetia-secrets
                  key: redis-url

          # Liveness probe - restart if worker is dead
          livenessProbe:
            httpGet:
              path: /health
              port: health
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
            successThreshold: 1

          # Readiness probe - remove from service if not ready
          readinessProbe:
            httpGet:
              path: /health
              port: health
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
            successThreshold: 1

          resources:
            requests:
              memory: '512Mi'
              cpu: '500m'
            limits:
              memory: '1Gi'
              cpu: '1000m'
```

### Service Definition

```yaml
apiVersion: v1
kind: Service
metadata:
  name: worker-health
  labels:
    app: helvetia-worker
spec:
  type: ClusterIP
  ports:
    - port: 3003
      targetPort: health
      protocol: TCP
      name: health
  selector:
    app: helvetia-worker
```

### Monitor Pod Health

```bash
# Check pod status
kubectl get pods -l app=helvetia-worker

# Describe pod to see probe results
kubectl describe pod <pod-name>

# View pod logs
kubectl logs -f <pod-name>

# Execute health check manually
kubectl exec <pod-name> -- curl localhost:3003/health
```

---

## Prometheus & Grafana

### Prometheus ServiceMonitor

For Prometheus Operator:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: worker-health
  labels:
    app: helvetia-worker
spec:
  selector:
    matchLabels:
      app: helvetia-worker
  endpoints:
    - port: health
      path: /health
      interval: 30s
      scrapeTimeout: 10s
```

### Prometheus Config (Static)

For standalone Prometheus:

```yaml
# prometheus.yml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

scrape_configs:
  - job_name: 'worker-health'
    static_configs:
      - targets: ['worker:3003']
        labels:
          service: 'helvetia-worker'
          environment: 'production'

    # Convert JSON response to metrics
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'up'
        target_label: worker_up
```

### Grafana Dashboard

Create a dashboard with the following panels:

1. **Worker Status**
   - Query: `up{job="worker-health"}`
   - Visualization: Stat panel (0 = down, 1 = up)

2. **Queue Depth**
   - Metrics: waiting jobs, active jobs
   - Visualization: Graph

3. **Uptime**
   - Metric: worker uptime
   - Visualization: Stat panel with time formatting

4. **Failed Jobs**
   - Metric: failed job count
   - Visualization: Counter

Example Grafana JSON:

```json
{
  "dashboard": {
    "title": "Worker Health",
    "panels": [
      {
        "title": "Worker Status",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"worker-health\"}"
          }
        ]
      },
      {
        "title": "Queue Statistics",
        "type": "graph",
        "targets": [
          {
            "expr": "worker_queue_waiting",
            "legendFormat": "Waiting"
          },
          {
            "expr": "worker_queue_active",
            "legendFormat": "Active"
          }
        ]
      }
    ]
  }
}
```

---

## Uptime Monitoring Services

### UptimeRobot

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Add new monitor:
   - **Monitor Type:** HTTP(s)
   - **URL:** `http://your-worker-url:3003/health`
   - **Monitoring Interval:** 5 minutes
   - **Monitor Timeout:** 30 seconds
3. Configure alerts (email, SMS, Slack, etc.)

### Pingdom

1. Log in to [Pingdom](https://www.pingdom.com)
2. Create new check:
   - **Check Type:** HTTP
   - **URL:** `http://your-worker-url:3003/health`
   - **Check Interval:** 1 minute
3. Set up alert contacts and policies

### Better Uptime

1. Go to [betteruptime.com](https://betteruptime.com)
2. Add monitor:
   - **URL:** `http://your-worker-url:3003/health`
   - **Expected Status Code:** 200
   - **Response Time Warning:** 2000ms
3. Configure on-call schedule and escalation

---

## Custom Monitoring Scripts

### Bash Script

```bash
#!/bin/bash

# worker-monitor.sh
# Simple health check script for cron or systemd timer

WORKER_URL="http://localhost:3003/health"
LOG_FILE="/var/log/worker-health.log"
ALERT_EMAIL="admin@example.com"

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL")

    if [ "$response" == "200" ]; then
        echo "[$(date)] Worker is healthy" >> "$LOG_FILE"
        return 0
    else
        echo "[$(date)] Worker is unhealthy (HTTP $response)" >> "$LOG_FILE"

        # Send alert
        echo "Worker health check failed with HTTP $response" | \
            mail -s "Worker Alert" "$ALERT_EMAIL"

        return 1
    fi
}

check_health
```

Add to crontab:

```bash
# Check every 5 minutes
*/5 * * * * /path/to/worker-monitor.sh
```

### Python Script

```python
#!/usr/bin/env python3
"""
Worker health monitoring script
Checks worker health and sends alerts
"""

import requests
import logging
from datetime import datetime

WORKER_URL = "http://localhost:3003/health"
LOG_FILE = "/var/log/worker-health.log"

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def check_worker_health():
    try:
        response = requests.get(WORKER_URL, timeout=10)
        data = response.json()

        if data['status'] == 'healthy':
            logging.info("Worker is healthy")
            logging.info(f"Queue stats - Waiting: {data['queue']['waiting']}, "
                        f"Active: {data['queue']['active']}, "
                        f"Failed: {data['queue']['failed']}")
            return True
        else:
            logging.warning(f"Worker is unhealthy: {data}")
            send_alert(data)
            return False

    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to check worker health: {e}")
        send_alert({'error': str(e)})
        return False

def send_alert(data):
    """Send alert via your preferred method"""
    # Example: Send to Slack
    # webhook_url = "your-slack-webhook-url"
    # requests.post(webhook_url, json={'text': f'Worker alert: {data}'})
    pass

if __name__ == "__main__":
    check_worker_health()
```

### Node.js Script

```javascript
// worker-monitor.js
const axios = require('axios');
const fs = require('fs').promises;

const WORKER_URL = 'http://localhost:3003/health';
const LOG_FILE = '/var/log/worker-health.log';

async function checkHealth() {
  try {
    const response = await axios.get(WORKER_URL, { timeout: 10000 });
    const data = response.data;

    const timestamp = new Date().toISOString();

    if (data.status === 'healthy') {
      await logMessage(
        `[${timestamp}] Worker healthy - Queue: ${data.queue.waiting} waiting, ${data.queue.active} active`,
      );
      return true;
    } else {
      await logMessage(`[${timestamp}] Worker unhealthy - ${JSON.stringify(data)}`);
      await sendAlert(data);
      return false;
    }
  } catch (error) {
    await logMessage(`[${new Date().toISOString()}] Error: ${error.message}`);
    await sendAlert({ error: error.message });
    return false;
  }
}

async function logMessage(message) {
  await fs.appendFile(LOG_FILE, message + '\n');
  console.log(message);
}

async function sendAlert(data) {
  // Implement your alert logic here
  // Example: Send to Slack, PagerDuty, etc.
}

// Run check
checkHealth();

// Or run periodically
// setInterval(checkHealth, 5 * 60 * 1000); // Every 5 minutes
```

---

## Alerting Configuration

### Slack Webhook

```javascript
// slack-alert.js
const axios = require('axios');

async function sendSlackAlert(workerData) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  const message = {
    text: '🚨 Worker Health Alert',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Worker Status:* ${workerData.status === 'healthy' ? '✅' : '❌'} ${workerData.status}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Redis:*\n${workerData.redis.connected ? '✅' : '❌'} ${workerData.redis.status}`,
          },
          {
            type: 'mrkdwn',
            text: `*Uptime:*\n${Math.floor(workerData.uptime / 3600)}h ${Math.floor((workerData.uptime % 3600) / 60)}m`,
          },
          {
            type: 'mrkdwn',
            text: `*Queue Waiting:*\n${workerData.queue.waiting}`,
          },
          {
            type: 'mrkdwn',
            text: `*Queue Failed:*\n${workerData.queue.failed}`,
          },
        ],
      },
    ],
  };

  await axios.post(webhookUrl, message);
}
```

### PagerDuty Integration

```javascript
// pagerduty-alert.js
const axios = require('axios');

async function sendPagerDutyAlert(workerData) {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;

  const event = {
    routing_key: routingKey,
    event_action: 'trigger',
    payload: {
      summary: 'Worker health check failed',
      severity: 'error',
      source: 'worker-health-check',
      custom_details: {
        status: workerData.status,
        redis_connected: workerData.redis.connected,
        queue_waiting: workerData.queue.waiting,
        queue_failed: workerData.queue.failed,
        uptime: workerData.uptime,
      },
    },
  };

  await axios.post('https://events.pagerduty.com/v2/enqueue', event);
}
```

### Email Alerts (SendGrid)

```javascript
// email-alert.js
const sgMail = require('@sendgrid/mail');

async function sendEmailAlert(workerData) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: 'admin@example.com',
    from: 'alerts@helvetia.cloud',
    subject: `Worker Health Alert - ${workerData.status}`,
    text: `
Worker Status: ${workerData.status}
Redis Connected: ${workerData.redis.connected}
Queue Waiting: ${workerData.queue.waiting}
Queue Active: ${workerData.queue.active}
Queue Failed: ${workerData.queue.failed}
Uptime: ${workerData.uptime}s
Timestamp: ${workerData.timestamp}
    `,
    html: `
<h2>Worker Health Alert</h2>
<table>
  <tr><td><strong>Status:</strong></td><td>${workerData.status}</td></tr>
  <tr><td><strong>Redis:</strong></td><td>${workerData.redis.connected ? 'Connected' : 'Disconnected'}</td></tr>
  <tr><td><strong>Queue Waiting:</strong></td><td>${workerData.queue.waiting}</td></tr>
  <tr><td><strong>Queue Active:</strong></td><td>${workerData.queue.active}</td></tr>
  <tr><td><strong>Queue Failed:</strong></td><td>${workerData.queue.failed}</td></tr>
  <tr><td><strong>Uptime:</strong></td><td>${workerData.uptime}s</td></tr>
</table>
    `,
  };

  await sgMail.send(msg);
}
```

---

## Best Practices

1. **Multiple Monitoring Layers**: Use both active (external) and passive (internal) monitoring
2. **Alert Fatigue**: Set appropriate thresholds to avoid alert fatigue
3. **Escalation Policies**: Define clear escalation paths for different severity levels
4. **Regular Testing**: Test your monitoring and alerting setup regularly
5. **Documentation**: Keep runbooks updated for common issues
6. **Metrics Retention**: Store historical metrics for trend analysis
7. **Dashboard Access**: Ensure team members have access to monitoring dashboards

---

## Troubleshooting

### Health Check Returns 503

- Check Redis connectivity
- Verify environment variables
- Review worker logs

### Health Check Times Out

- Ensure worker service is running
- Check firewall rules
- Verify port configuration

### False Positives

- Increase timeout values
- Adjust retry counts
- Review probe frequency

---

## Additional Resources

- [Worker Health Check Documentation](./HEALTH_CHECK.md)
- [BullMQ Monitoring Guide](https://docs.bullmq.io/guide/metrics)
- [Redis Monitoring Best Practices](https://redis.io/docs/manual/admin/)
