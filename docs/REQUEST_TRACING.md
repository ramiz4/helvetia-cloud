# Request ID Tracing

This document describes how request ID tracing works in Helvetia Cloud, enabling you to trace requests across all services for debugging and monitoring purposes.

## Overview

Request ID tracing assigns a unique identifier (UUID) to each incoming HTTP request. This ID is:

- Generated automatically by the API server
- Propagated to background workers (BullMQ jobs)
- Included in all log entries
- Returned to clients in response headers
- Used to correlate logs across services

## How It Works

### 1. Request ID Generation

The API server automatically generates a unique request ID for every incoming request using the Fastify `genReqId` function:

```typescript
// In server.ts
genReqId: (req) => {
  // Use existing request ID header if provided, otherwise generate new one
  return (req.headers['x-request-id'] as string) || crypto.randomUUID();
};
```

**Client-Provided Request IDs**: If a client sends an `X-Request-Id` header, the server will use that ID instead of generating a new one. This is useful for:

- End-to-end tracing across multiple systems
- Debugging specific requests from client logs
- Maintaining correlation with external monitoring systems

### 2. Response Headers

The request ID is automatically added to all HTTP responses via the `requestIdMiddleware`:

```typescript
// Response header example
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
```

This allows clients to:

- Reference specific requests in support tickets
- Correlate client-side and server-side logs
- Track requests across multiple API calls

### 3. Logging Integration

The request ID is included in all structured logs:

#### API Server Logs

```typescript
// Request logging (onRequest hook)
{
  reqId: "550e8400-e29b-41d4-a716-446655440000",
  method: "POST",
  url: "/api/v1/services/abc123/deploy",
  userId: "user123",
  ip: "192.168.1.1"
}

// Response logging (onResponse hook)
{
  reqId: "550e8400-e29b-41d4-a716-446655440000",
  method: "POST",
  url: "/api/v1/services/abc123/deploy",
  statusCode: 200,
  responseTime: "125.43ms"
}
```

#### Worker Service Logs

The request ID is propagated to BullMQ jobs and included in worker logs:

```typescript
// Worker deployment logs
[reqId: 550e8400-e29b-41d4-a716-446655440000] Starting deployment dep123 for service my-app
[reqId: 550e8400-e29b-41d4-a716-446655440000] Found 1 running containers for rollback if needed
[reqId: 550e8400-e29b-41d4-a716-446655440000] Deployment dep123 successful!
```

### 4. Cross-Service Propagation

Request IDs are propagated from the API to the Worker service through BullMQ job data:

```typescript
// API creates deployment job with request ID
await deploymentQueue.add('build', {
  deploymentId: 'dep123',
  serviceId: 'svc456',
  // ... other job data
  requestId: request.id, // Propagate request ID
});

// Worker extracts request ID from job data
const { deploymentId, requestId } = job.data;
const logPrefix = requestId ? `[reqId: ${requestId}] ` : '';
console.log(`${logPrefix}Starting deployment ${deploymentId}...`);
```

## Usage Examples

### Debugging a Failed Deployment

1. **Client initiates deployment:**

   ```bash
   curl -X POST https://api.helvetia.cloud/api/v1/services/svc123/deploy \
     -H "Authorization: Bearer <token>"
   ```

2. **Client receives response with request ID:**

   ```http
   HTTP/1.1 200 OK
   X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
   Content-Type: application/json

   {
     "id": "dep123",
     "status": "QUEUED",
     ...
   }
   ```

3. **Search logs using request ID:**

   ```bash
   # Find all logs related to this request
   docker-compose logs api | grep "550e8400-e29b-41d4-a716-446655440000"
   docker-compose logs worker | grep "550e8400-e29b-41d4-a716-446655440000"
   ```

4. **Example log output:**
   ```
   api_1    | {"reqId":"550e8400-e29b-41d4-a716-446655440000","method":"POST","url":"/api/v1/services/svc123/deploy","userId":"usr789"}
   worker_1 | [reqId: 550e8400-e29b-41d4-a716-446655440000] Starting deployment dep123 for service my-app
   worker_1 | [reqId: 550e8400-e29b-41d4-a716-446655440000] Environment variable validation failed: PORT must be a number
   ```

### Client-Provided Request IDs

Clients can provide their own request ID for end-to-end tracing:

```bash
curl -X POST https://api.helvetia.cloud/api/v1/services/svc123/deploy \
  -H "Authorization: Bearer <token>" \
  -H "X-Request-Id: my-custom-trace-id"
```

The server will use `my-custom-trace-id` instead of generating a UUID.

### Monitoring Request Flow

```bash
# Monitor real-time logs for a specific request
docker-compose logs -f api worker | grep "550e8400-e29b-41d4-a716-446655440000"
```

## Log Aggregation

When using log aggregation tools (Loki, CloudWatch, etc.), you can:

1. **Filter by request ID:**

   ```
   {app="helvetia-api"} |~ "550e8400-e29b-41d4-a716-446655440000"
   ```

2. **Create dashboards:** Group metrics by request ID to analyze:
   - End-to-end latency
   - Request volume by endpoint
   - Error rates correlated with specific requests

3. **Set up alerts:** Trigger alerts when specific request patterns are detected

## Best Practices

### For Developers

1. **Always log request IDs:** When adding new log statements, include the request ID:

   ```typescript
   // API service
   request.log.info({ reqId: request.id, userId: request.user.id }, 'Processing request');

   // Worker service
   const { requestId } = job.data;
   const logPrefix = requestId ? `[reqId: ${requestId}] ` : '';
   console.log(`${logPrefix}Processing job...`);
   ```

2. **Propagate to downstream services:** When calling external APIs or queuing jobs, pass the request ID:

   ```typescript
   await externalService.call({
     headers: { 'X-Request-Id': request.id },
     data: payload,
   });
   ```

3. **Document in API responses:** Include request ID in error responses for easier debugging:
   ```typescript
   return reply.status(500).send({
     error: 'Internal server error',
     requestId: request.id,
     message: 'Something went wrong',
   });
   ```

### For Operators

1. **Enable log persistence:** Ensure logs are persisted with retention policies
2. **Index by request ID:** Configure log aggregation to index the `reqId` field
3. **Monitor request volume:** Track unique request IDs per time period
4. **Set up distributed tracing:** Use request IDs as trace IDs in APM tools

### For API Consumers

1. **Store request IDs:** Save the `X-Request-Id` header from responses
2. **Include in support tickets:** Reference request IDs when reporting issues
3. **Use for debugging:** Provide request IDs to help support teams investigate problems
4. **Generate your own IDs:** For end-to-end tracing, send your own `X-Request-Id` header

## Configuration

Request ID tracing is enabled by default with no configuration required. However, you can customize behavior:

### Environment Variables

```bash
# Enable request/response logging (includes request IDs)
LOG_REQUESTS=true
LOG_RESPONSES=true

# Set log level (all levels include request IDs)
LOG_LEVEL=info  # Options: trace, debug, info, warn, error, fatal
```

### Fastify Configuration

The request ID generation logic is in `apps/api/src/server.ts`:

```typescript
export const fastify = Fastify({
  genReqId: (req) => {
    // Customize this function to change request ID format
    return (req.headers['x-request-id'] as string) || crypto.randomUUID();
  },
  // ... other config
});
```

## Troubleshooting

### Request ID Not in Logs

**Problem:** Logs don't include request IDs

**Solution:**

- Ensure `LOG_REQUESTS=true` and `LOG_RESPONSES=true` in `.env`
- Verify you're not in test environment (logging disabled in tests)
- Check that logs are using structured format (JSON)

### Request ID Not in Response Headers

**Problem:** `X-Request-Id` header missing from responses

**Solution:**

- Verify `requestIdMiddleware` is registered in `server.ts`
- Check that middleware is running before route handlers
- Ensure no errors in middleware execution

### Request ID Not Propagated to Worker

**Problem:** Worker logs don't include request ID

**Solution:**

- Verify `requestId` is included in job data when calling `deploymentQueue.add()`
- Check that controllers pass `request.id` to service methods
- Ensure worker extracts `requestId` from `job.data`

## Related Documentation

- [API Documentation](./API_VERSIONING.md)
- [Error Handling](./ERROR_CODES.md)
- [Logging Configuration](.env.example)

## Future Enhancements

Planned improvements to request ID tracing:

1. **OpenTelemetry Integration:** Replace custom request IDs with OpenTelemetry trace IDs
2. **Distributed Tracing:** Add span IDs for sub-operations within a request
3. **Request ID Dashboard:** Grafana dashboard showing request flow visualization
4. **Automatic Correlation:** Link request IDs to deployment IDs, service IDs, and user IDs
5. **Request Replay:** Use request IDs to replay failed requests for debugging
