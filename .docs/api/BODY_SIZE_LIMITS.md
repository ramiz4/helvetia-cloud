# Request Body Size Limits

## Overview

Request body size limits have been implemented to protect against DoS (Denial of Service) attacks. These limits prevent attackers from sending extremely large payloads that could exhaust server resources (memory, CPU, network bandwidth).

## Configuration

### Global Limit

- **10MB** - Maximum size for any request body across all endpoints
- Configured in Fastify initialization: `bodyLimit: 10 * 1024 * 1024`

### Route-Specific Limits

Different endpoints have different size requirements based on their use case:

| Endpoint                | Limit | Reason                                              |
| ----------------------- | ----- | --------------------------------------------------- |
| `POST /auth/github`     | 100KB | Authentication requests are small (only OAuth code) |
| `POST /services`        | 100KB | Service configurations are typically small          |
| `PATCH /services/:id`   | 100KB | Service updates are typically small                 |
| `POST /webhooks/github` | 1MB   | GitHub webhook payloads can be moderate in size     |
| All other endpoints     | 10MB  | Default global limit applies                        |

## Error Response

When a request exceeds the configured body size limit, the server returns a `413 Payload Too Large` error:

```json
{
  "statusCode": 413,
  "error": "Payload Too Large",
  "message": "Request body exceeds the maximum allowed size of XMB"
}
```

## Implementation Details

### Code Location

- Configuration: `apps/api/src/server.ts`
- Error handler: `fastify.setErrorHandler()` in `server.ts`
- Tests: `apps/api/src/body-limit.test.ts`

### Constants

```typescript
const BODY_LIMIT_GLOBAL = 10 * 1024 * 1024; // 10MB
const BODY_LIMIT_STANDARD = 1 * 1024 * 1024; // 1MB
const BODY_LIMIT_SMALL = 100 * 1024; // 100KB
```

### Applying Route-Specific Limits

```typescript
fastify.post(
  '/endpoint',
  {
    bodyLimit: BODY_LIMIT_SMALL, // Override global limit
  },
  async (request, reply) => {
    // Handler code
  },
);
```

## Security Considerations

1. **DoS Protection**: Limits prevent memory exhaustion from large payloads
2. **Performance**: Smaller limits reduce parsing time and memory usage
3. **Resource Management**: Helps maintain predictable resource consumption

## Testing

Tests for body size limits are located in `apps/api/src/body-limit.test.ts` and cover:

- Rejection of oversized payloads
- Acceptance of valid-sized payloads
- Proper error response format
- Route-specific limit enforcement

## Future Improvements

Consider implementing:

- Configurable limits via environment variables
- Per-user rate limiting combined with body size limits
- Metrics/monitoring for blocked large requests
- Adaptive limits based on system resources
