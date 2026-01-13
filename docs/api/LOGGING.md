# API Logging Documentation

This document describes the structured logging implementation for the Helvetia Cloud API.

## Overview

The API uses **Fastify's built-in Pino logger** for high-performance, structured JSON logging with automatic request ID correlation and sensitive data redaction.

## Features

- ✅ **Request ID Correlation**: Every request gets a unique ID (UUID) for tracing across logs
- ✅ **Structured Logging**: JSON format in production, pretty-printed in development
- ✅ **Sensitive Data Redaction**: Automatic removal of passwords, tokens, and auth headers
- ✅ **Request/Response Logging**: Comprehensive logging of all HTTP transactions
- ✅ **Configurable Log Levels**: Adjust verbosity per environment
- ✅ **Performance Metrics**: Response times tracked for every request
- ✅ **Error Context**: Enhanced error logging with stack traces and context

## Log Levels

Logs are categorized by severity (from most to least verbose):

| Level   | Numeric | Usage                           | Example                          |
| ------- | ------- | ------------------------------- | -------------------------------- |
| `fatal` | 60      | Application crash               | Database connection lost         |
| `error` | 50      | Errors requiring attention      | Failed deployment, API errors    |
| `warn`  | 40      | Warning conditions              | Deprecated API usage, 4xx errors |
| `info`  | 30      | General informational (default) | Request/response logs            |
| `debug` | 20      | Debug information               | State changes, variable values   |
| `trace` | 10      | Very detailed debug             | Function entry/exit              |

## Configuration

### Environment Variables

```bash
# Set log level (default: info)
LOG_LEVEL=info

# Enable/disable request logging (default: true)
LOG_REQUESTS=true

# Enable/disable response logging (default: true)
LOG_RESPONSES=true

# Node environment affects log format
NODE_ENV=production  # JSON output
NODE_ENV=development # Pretty-printed, colorized
NODE_ENV=test        # Logging disabled
```

### Log Levels by Environment

**Production:**

- Default: `info`
- Logs: JSON structured
- Format: `{"level":30,"time":1234567890,"msg":"...",...}`

**Development:**

- Default: `info`
- Logs: Pretty-printed with colors
- Format: `[HH:MM:ss] INFO: Request completed: GET /services - 200 (45.23ms)`

**Test:**

- Logging: Disabled
- Reason: Cleaner test output

## Log Format

### Request Logs

Captured at the start of each request:

```json
{
  "level": 30,
  "time": 1673456789000,
  "pid": 12345,
  "hostname": "api-server",
  "reqId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "url": "/services",
  "path": "/services",
  "query": {},
  "userId": "user_abc123",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0 ...",
  "msg": "Incoming request: POST /services"
}
```

### Response Logs

Captured after each response is sent:

```json
{
  "level": 30,
  "time": 1673456789150,
  "pid": 12345,
  "hostname": "api-server",
  "reqId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "url": "/services",
  "statusCode": 201,
  "responseTime": "45.23ms",
  "userId": "user_abc123",
  "msg": "Request completed: POST /services - 201 (45.23ms)"
}
```

### Error Logs

When errors occur (4xx or 5xx status codes):

```json
{
  "level": 50,
  "time": 1673456789000,
  "pid": 12345,
  "hostname": "api-server",
  "reqId": "550e8400-e29b-41d4-a716-446655440000",
  "err": {
    "type": "Error",
    "message": "Service not found",
    "stack": "Error: Service not found\n    at ...",
    "code": "FST_ERR_NOT_FOUND",
    "statusCode": 404
  },
  "method": "GET",
  "url": "/services/invalid-id",
  "statusCode": 404,
  "responseTime": "12.45ms",
  "msg": "Request completed: GET /services/invalid-id - 404 (12.45ms)"
}
```

## Request ID Correlation

Every request is assigned a unique ID that appears in all related log entries:

```json
// Client sends request
{"reqId": "550e8400-...", "msg": "Incoming request: GET /services"}

// Application processes
{"reqId": "550e8400-...", "msg": "Fetching services for user_abc123"}

// Response sent
{"reqId": "550e8400-...", "msg": "Request completed: GET /services - 200"}
```

### Custom Request IDs

Clients can provide their own request ID via the `X-Request-ID` header:

```bash
curl -H "X-Request-ID: my-custom-id-123" https://api.helvetia.cloud/services
```

This ID will be used throughout the request lifecycle.

## Sensitive Data Redaction

The following paths are automatically redacted from logs:

- `req.headers.authorization` - Bearer tokens, Basic auth
- `req.headers.cookie` - Session cookies, auth tokens
- `req.body.password` - User passwords
- `req.body.token` - API tokens
- `req.body.secret` - Secrets and keys
- `req.body.githubAccessToken` - GitHub OAuth tokens

**Example (redacted):**

```json
{
  "req": {
    "method": "POST",
    "url": "/auth/github",
    "headers": {
      "host": "api.helvetia.cloud",
      "user-agent": "curl/7.68.0"
      // authorization and cookie fields removed
    }
    // body.password and body.token fields removed
  }
}
```

## Usage Examples

### In Application Code

```typescript
// Using the Fastify logger in route handlers
fastify.get('/services', async (request, reply) => {
  // Log with context
  request.log.info({ userId: user.id }, 'Fetching services for user');

  try {
    const services = await prisma.service.findMany({ where: { userId: user.id } });

    // Log success
    request.log.debug({ count: services.length }, 'Services fetched successfully');

    return services;
  } catch (error) {
    // Log error with context
    request.log.error({ err: error, userId: user.id }, 'Failed to fetch services');
    throw error;
  }
});
```

### Searching Logs

**Find all requests from a specific user:**

```bash
grep '"userId":"user_abc123"' api.log
```

**Find all errors:**

```bash
grep '"level":50' api.log  # Error level
```

**Trace a specific request:**

```bash
grep '"reqId":"550e8400-e29b-41d4-a716-446655440000"' api.log
```

**Find slow requests (>1000ms):**

```bash
grep -E '"responseTime":"[0-9]{4,}\.[0-9]+ms"' api.log
```

## Log Analysis Tools

### Development (Pretty Logs)

In development, logs are automatically pretty-printed:

```bash
pnpm --filter api dev
```

Output:

```
[12:34:56] INFO: Incoming request: GET /services
[12:34:56] INFO: Request completed: GET /services - 200 (45.23ms)
```

### Production (JSON Logs)

In production, use log analysis tools:

**pino-pretty** (for ad-hoc viewing):

```bash
tail -f /var/log/api.log | pnpm exec pino-pretty
```

**jq** (for querying):

```bash
# Get all error logs
cat api.log | jq 'select(.level >= 50)'

# Get average response time
cat api.log | jq -s 'map(select(.responseTime)) | map(.responseTime | rtrimstr("ms") | tonumber) | add / length'
```

**Elasticsearch/Kibana** (recommended for production):

- Ingest JSON logs into Elasticsearch
- Create dashboards in Kibana
- Set up alerts for error rates

## Performance Impact

- **Minimal overhead**: Pino is one of the fastest Node.js loggers
- **Asynchronous**: Logging doesn't block request processing
- **No impact in tests**: Logging is disabled during test runs

## Troubleshooting

### Logs not appearing

Check that logging is enabled:

```bash
echo $NODE_ENV  # Should not be 'test'
echo $LOG_REQUESTS  # Should be 'true' or unset
echo $LOG_RESPONSES  # Should be 'true' or unset
```

### Too verbose logs

Reduce log level:

```bash
export LOG_LEVEL=warn  # Only warnings and errors
```

### Need more detail

Increase log level:

```bash
export LOG_LEVEL=debug  # Include debug messages
export LOG_LEVEL=trace  # Maximum verbosity
```

## Security Considerations

1. **Never log sensitive data**: Passwords, tokens, secrets are automatically redacted
2. **Rotate logs regularly**: Prevent disk space issues
3. **Secure log access**: Restrict who can read production logs
4. **Sanitize user input**: Prevent log injection attacks
5. **Monitor log volume**: Unexpected spikes may indicate attacks

## Best Practices

1. **Use structured logging**: Include context objects

   ```typescript
   request.log.info({ serviceId, userId }, 'Service created');
   ```

2. **Choose appropriate levels**:
   - `info`: Normal operations
   - `warn`: Potentially problematic situations
   - `error`: Definite problems requiring attention

3. **Include request IDs**: Always use `request.log` (not `console.log`)

4. **Don't log in hot paths**: Avoid trace/debug logs in frequently called functions

5. **Add business context**: Log user actions, state changes, important decisions

## Migration Guide

If you're updating existing code that uses `console.log`:

**Before:**

```typescript
console.log('User created:', userId);
```

**After:**

```typescript
request.log.info({ userId }, 'User created');
```

## Related Documentation

- [Fastify Logging](https://www.fastify.io/docs/latest/Reference/Logging/)
- [Pino Documentation](https://getpino.io/)
- [Backend Instructions](.github/instructions/backend.instructions.md)
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
