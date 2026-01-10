# Logging Implementation - Visual Examples

This document shows actual examples of the logging output in different environments.

## Development Mode (Pretty Logs)

When running in development mode (`NODE_ENV=development`), logs are pretty-printed and colorized for easy reading:

```
[12:34:56] INFO: Incoming request: GET /services
    reqId: "550e8400-e29b-41d4-a716-446655440000"
    method: "GET"
    url: "/services"
    path: "/services"
    query: {}
    userId: "user_abc123"
    ip: "::1"
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

[12:34:56] INFO: Request completed: GET /services - 200 (45.23ms)
    reqId: "550e8400-e29b-41d4-a716-446655440000"
    method: "GET"
    url: "/services"
    statusCode: 200
    responseTime: "45.23ms"
    userId: "user_abc123"
```

## Production Mode (JSON Logs)

In production (`NODE_ENV=production`), logs are structured JSON for easy parsing and analysis:

```json
{
  "level": 30,
  "time": 1673456789000,
  "pid": 12345,
  "hostname": "api-server-prod",
  "reqId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "url": "/services",
  "path": "/services",
  "query": {},
  "userId": "user_abc123",
  "ip": "10.0.1.5",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "msg": "Incoming request: GET /services"
}

{
  "level": 30,
  "time": 1673456789045,
  "pid": 12345,
  "hostname": "api-server-prod",
  "reqId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "url": "/services",
  "statusCode": 200,
  "responseTime": "45.23ms",
  "userId": "user_abc123",
  "msg": "Request completed: GET /services - 200 (45.23ms)"
}
```

## Error Logging Example

When an error occurs (4xx or 5xx status code):

### Development:

```
[12:35:12] WARN: Request completed: GET /services/invalid-id - 404 (12.45ms)
    reqId: "661f9510-f39c-52e5-b827-557766551111"
    method: "GET"
    url: "/services/invalid-id"
    statusCode: 404
    responseTime: "12.45ms"
    userId: "user_abc123"
```

### Production:

```json
{
  "level": 40,
  "time": 1673456792000,
  "pid": 12345,
  "hostname": "api-server-prod",
  "reqId": "661f9510-f39c-52e5-b827-557766551111",
  "method": "GET",
  "url": "/services/invalid-id",
  "statusCode": 404,
  "responseTime": "12.45ms",
  "userId": "user_abc123",
  "msg": "Request completed: GET /services/invalid-id - 404 (12.45ms)"
}
```

## Sensitive Data Redaction

The logging system automatically redacts sensitive information:

### Before Redaction (what the server receives):

```javascript
{
  headers: {
    authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    cookie: "token=abc123; refreshToken=def456"
  },
  body: {
    username: "john",
    password: "supersecret123",
    githubAccessToken: "ghp_1234567890abcdef"
  }
}
```

### After Redaction (what appears in logs):

```json
{
  "level": 30,
  "reqId": "772fa621-g40d-63f6-c938-668877662222",
  "req": {
    "method": "POST",
    "url": "/auth/github",
    "headers": {
      "host": "api.helvetia.cloud"
      // authorization and cookie removed
    }
    // body.password, body.token, body.githubAccessToken removed
  },
  "msg": "Incoming request: POST /auth/github"
}
```

## Request ID Correlation

All logs for a single request share the same `reqId`, making it easy to trace the lifecycle of a request:

```json
// Client makes request
{"reqId": "883gb732-h51e-74g7-d049-779988773333", "msg": "Incoming request: POST /services/:id/deploy"}

// Application processing
{"reqId": "883gb732-h51e-74g7-d049-779988773333", "msg": "Triggering deployment for service test-app"}
{"reqId": "883gb732-h51e-74g7-d049-779988773333", "msg": "Queued deployment job"}

// Response sent
{"reqId": "883gb732-h51e-74g7-d049-779988773333", "statusCode": 201, "msg": "Request completed: POST /services/:id/deploy - 201 (123.45ms)"}
```

## Custom Request IDs

Clients can provide their own request ID for end-to-end tracing:

```bash
# Client sends request with custom ID
curl -H "X-Request-ID: my-trace-id-12345" https://api.helvetia.cloud/services

# All logs for this request will use the custom ID
{"reqId": "my-trace-id-12345", "msg": "Incoming request: GET /services"}
{"reqId": "my-trace-id-12345", "msg": "Request completed: GET /services - 200 (23.45ms)"}
```

## Performance Metrics

Response times are automatically tracked and logged:

```json
{
  "level": 30,
  "reqId": "994hc843-i62f-85h8-e150-880099884444",
  "method": "GET",
  "url": "/services/:id/metrics",
  "statusCode": 200,
  "responseTime": "1234.56ms", // Slow request
  "msg": "Request completed: GET /services/:id/metrics - 200 (1234.56ms)"
}
```

Fast queries:

```json
{"responseTime": "5.23ms"}    // Very fast
{"responseTime": "45.67ms"}   // Normal
{"responseTime": "523.89ms"}  // Slow
{"responseTime": "2345.12ms"} // Very slow - investigate!
```

## Log Levels in Action

Different log levels for different scenarios:

```json
// INFO (30) - Normal operation
{"level": 30, "msg": "Request completed: GET /health - 200 (1.23ms)"}

// WARN (40) - Client errors (4xx)
{"level": 40, "msg": "Request completed: POST /services - 400 (5.67ms)"}

// ERROR (50) - Server errors (5xx)
{"level": 50, "msg": "Request completed: GET /services/:id - 500 (89.01ms)"}

// DEBUG (20) - Detailed debugging info
{"level": 20, "msg": "Fetching services from database", "userId": "user_abc123"}

// TRACE (10) - Very detailed debugging
{"level": 10, "msg": "Parsing request body", "contentType": "application/json"}
```

## Querying Logs

### Find all requests from a user:

```bash
grep '"userId":"user_abc123"' api.log | jq .
```

### Find slow requests (>1 second):

```bash
grep -E '"responseTime":"[0-9]{4,}\.' api.log | jq .
```

### Trace a specific request:

```bash
grep '"reqId":"550e8400-e29b-41d4-a716-446655440000"' api.log | jq .
```

### Find all errors today:

```bash
grep '"level":50' api.log | jq 'select(.time > '$(($(date +%s) - 86400))'000)'
```

### Get request counts by endpoint:

```bash
jq -r .url api.log | sort | uniq -c | sort -rn
```

### Average response time:

```bash
jq -s 'map(select(.responseTime)) | map(.responseTime | rtrimstr("ms") | tonumber) | add / length' api.log
```

## Integration with Monitoring Tools

The structured JSON logs can be easily ingested into monitoring and observability platforms:

- **Elasticsearch + Kibana**: Index logs for powerful search and visualization
- **Datadog**: Stream logs for real-time monitoring and alerting
- **CloudWatch Logs**: AWS native log aggregation
- **Grafana Loki**: Lightweight log aggregation
- **Splunk**: Enterprise log management

All of these tools can parse the JSON structure and create dashboards showing:

- Request rate over time
- Response time percentiles (p50, p95, p99)
- Error rate by endpoint
- User activity patterns
- Performance bottlenecks
