# SSE Connection Lifecycle and Token Validation

## Overview

Server-Sent Events (SSE) are used for real-time updates in the Helvetia Cloud platform. This document describes how SSE connections are managed, authenticated, how token expiration is handled, and the memory leak prevention measures implemented.

## SSE Endpoints

### 1. Metrics Stream: `/services/metrics/stream`

**Purpose:** Provides real-time container metrics (CPU, memory, status) for all user services.

**Update Frequency:** Every 5 seconds

**Authentication:** Requires valid JWT token

**Features:**

- Token validation on every metrics update cycle
- Graceful connection closure on token expiration
- Automatic client-side reconnection handling

### 2. Deployment Logs Stream: `/deployments/:id/logs/stream`

**Purpose:** Streams live deployment logs during build and deployment process.

**Update Frequency:** Real-time (as logs are generated)

**Authentication:** Requires valid JWT token + deployment ownership verification

**Features:**

- Periodic token validation (every 30 seconds)
- Graceful connection closure on token expiration
- Automatic client-side reconnection handling

## Token Configuration

JWT tokens are configured with the following settings:

```javascript
{
  secret: process.env.JWT_SECRET || 'supersecret',
  sign: {
    expiresIn: '7d' // Tokens expire after 7 days
  }
}
```

## Connection Lifecycle

### Initial Connection

1. **Client** initiates EventSource connection with credentials
2. **Server** validates JWT token via `onRequest` hook
3. If valid:
   - Connection established (HTTP 200)
   - SSE headers sent
   - Connection state initialized with tracking metrics
   - Initial data transmitted
4. If invalid:
   - Connection rejected (HTTP 401)
   - Client receives error

### Active Connection

**Metrics Stream:**

- Every 5 seconds, server:
  1. Checks connection validity
  2. Validates JWT token using `validateToken()` function
  3. If valid: Fetches and sends updated metrics
  4. If invalid: Sends error event and calls cleanup()
  5. On error: Increments error counter, closes after 3 consecutive errors

**Logs Stream:**

- Every 30 seconds, server validates JWT token
- On each Redis message:
  1. Checks if connection is still valid
  2. If valid: Forwards log line to client (wrapped in try-catch)
  3. If invalid: Drops message (connection already closed)
  4. On write error: Increments error counter, closes after 3 consecutive errors

### Token Expiration Handling

When a token expires during an active SSE connection:

**Server-side:**

1. Token validation fails during periodic check
2. Server sends error event to client:
   ```
   event: error
   data: {"error": "Token expired", "code": "TOKEN_EXPIRED"}
   ```
3. Connection is closed gracefully
4. Resources are cleaned up (intervals, listeners)

**Client-side:**

1. Receives error event with `TOKEN_EXPIRED` code
2. Displays user-friendly message: "Session expired. Please log in again."
3. Clears local authentication state
4. Redirects to login page

### Connection Closure

Connections can be closed by:

1. **Client disconnect:** User navigates away or closes browser
   - Server detects `close` event on request
   - Calls centralized `cleanup()` function
   - Clears intervals, timeouts, and Redis subscriptions
   - Logs connection statistics (duration, messages, errors)

2. **Token expiration:** Token becomes invalid
   - Server sends error event
   - Server closes connection
   - Calls `cleanup()` to free all resources
   - Client logs out user

3. **Server error:** Unexpected error during operation
   - Error counter incremented
   - After 3 consecutive errors, connection closed
   - `cleanup()` called to free resources
   - Client's `onerror` handler triggers automatic reconnection

4. **Connection timeout:** Connection exceeds maximum duration
   - Metrics stream: 30 minutes
   - Logs stream: 60 minutes
   - Server sends timeout error event
   - `cleanup()` called to free all resources

5. **Stream errors:** Error on request or reply stream
   - Error event listener triggers `cleanup()`
   - All resources freed immediately

## Memory Leak Prevention

### Problem Statement

Long-lived SSE connections can cause memory leaks if resources are not properly cleaned up:

1. **Interval leaks:** `setInterval` calls without corresponding `clearInterval`
2. **Timeout leaks:** `setTimeout` calls without corresponding `clearTimeout`
3. **Event listener leaks:** Event listeners not removed on disconnect
4. **Redis subscription leaks:** Subscriptions not properly unsubscribed
5. **Indefinite connections:** No timeout mechanism allowing connections to persist forever
6. **Error accumulation:** Errors in callbacks not properly handled, resources not freed

### Solution Implemented

#### 1. Centralized Cleanup Function

Both endpoints now have a centralized `cleanup()` function that:

- Checks if already cleaned up (idempotent)
- Clears all intervals
- Clears all timeouts
- Unsubscribes from Redis channels
- Removes event listeners
- Logs connection statistics for monitoring

#### 2. Connection State Tracking

Instead of a simple boolean, connection state is now a comprehensive object:

```typescript
const connectionState = {
  isValid: boolean, // Connection validity flag
  startTime: number, // Connection start timestamp
  metricsCount: number, // Messages sent counter (metrics)
  messagesReceived: number, // Messages received counter (logs)
  validationAttempts: number, // Token validation attempts
  errorCount: number, // Error counter for circuit breaker
};
```

#### 3. Resource Tracking

All resources are explicitly tracked:

```typescript
let metricsInterval: NodeJS.Timeout | null = null;
let tokenValidationInterval: NodeJS.Timeout | null = null;
let timeoutHandle: NodeJS.Timeout | null = null;
let isSubscribed: boolean = false; // Redis subscription flag
```

#### 4. Error Handling

- All async operations wrapped in try-catch
- Error counter increments on failures
- Connection closes after 3 consecutive errors
- All write operations wrapped in try-catch to handle broken pipes
- Cleanup called on all error paths

#### 5. Connection Timeout

- Metrics stream: 30 minutes (configurable via `CONNECTION_TIMEOUT_MS`)
- Logs stream: 60 minutes (configurable via `CONNECTION_TIMEOUT_MS`)
- Prevents indefinite connections from accumulating
- Timeout sends error event to client before closing

#### 6. Multiple Error Event Listeners

Error handling on all possible failure points:

- `request.raw.on('error')` - Client connection errors
- `request.raw.on('close')` - Client disconnect
- `reply.raw.on('error')` - Server write errors
- Token validation errors
- Redis subscription errors
- Database query errors
- Docker API errors

#### 7. Graceful Degradation

- Token validation failure → Close connection gracefully
- Redis subscription failure → Return 500 error before establishing stream
- Write errors → Increment counter, close after threshold
- Database errors → Increment counter, close after threshold

### Monitoring and Observability

Connection statistics logged on cleanup:

```
SSE metrics connection cleaned up for user {userId}.
Duration: {duration}ms, Metrics sent: {count}, Errors: {errorCount}
```

This helps identify:

- Average connection duration
- Message throughput
- Error rates
- Abnormal patterns (e.g., connections closing too quickly)

### Testing

See `apps/api/src/sse-memory-leak.test.ts` for comprehensive test coverage:

- ✅ Error handling in callbacks
- ✅ Multiple consecutive errors
- ✅ Interval cleanup on disconnect
- ✅ Timeout cleanup on disconnect
- ✅ Redis subscription cleanup
- ✅ Token expiration handling
- ✅ Write error handling
- ✅ Connection timeout mechanism
- ✅ Connection state tracking

### Why Periodic Token Validation?

Long-lived SSE connections could potentially allow access after token expiration if not properly validated. Periodic validation ensures:

1. **Access revocation:** If a token is revoked or expires, access is terminated within validation interval
2. **Security compliance:** Aligns with best practices for session management
3. **Resource protection:** Prevents unauthorized access to sensitive real-time data

### Validation Frequency

- **Metrics Stream:** Every 5 seconds (on each update cycle)
  - Frequent validation due to high update rate
  - Minimal performance impact (validation is fast)

- **Logs Stream:** Every 30 seconds (separate validation interval)
  - Less frequent due to event-driven nature
  - Balances security with performance

### Token Storage

Tokens are stored in:

1. **HTTP-only cookies** (primary method)
2. **Authorization header** (fallback)

Both methods are sent with SSE connections via `withCredentials: true`.

## Client Implementation

### Metrics Stream

```typescript
useEffect(() => {
  if (isAuthenticated) {
    const eventSource = new EventSource('/services/metrics/stream', {
      withCredentials: true,
    });

    // Handle token expiration
    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.code === 'TOKEN_EXPIRED') {
          toast.error('Session expired. Please log in again.');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
          eventSource.close();
        }
      } catch {
        // Not a JSON error event
      }
    });

    // Handle metrics updates
    eventSource.onmessage = (event) => {
      const updates = JSON.parse(event.data);
      updateMetrics(updates);
    };

    return () => eventSource.close();
  }
}, [isAuthenticated]);
```

### Logs Stream

```typescript
useEffect(() => {
  if (!activeDeploymentId) return;

  const eventSource = new EventSource(`/deployments/${activeDeploymentId}/logs/stream`, {
    withCredentials: true,
  });

  // Handle token expiration
  eventSource.addEventListener('error', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.code === 'TOKEN_EXPIRED') {
        toast.error('Session expired. Please log in again.');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        eventSource.close();
      }
    } catch {
      // Not a JSON error event
    }
  });

  // Handle log updates
  eventSource.onmessage = (event) => {
    setLogs((prev) => prev + event.data);
  };

  return () => eventSource.close();
}, [activeDeploymentId]);
```

## Server Implementation

### Token Validation Utility

```typescript
async function validateToken(request: any, fastifyInstance: typeof fastify): Promise<boolean> {
  try {
    await request.jwtVerify();
    return true;
  } catch (error) {
    console.log('Token validation failed:', (error as Error).message);
    return false;
  }
}
```

### Metrics Stream Handler

```typescript
fastify.get('/services/metrics/stream', async (request, reply) => {
  const user = request.user;

  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let isConnectionValid = true;

  const sendMetrics = async () => {
    // Validate token before sending
    const isValid = await validateToken(request, fastify);
    if (!isValid) {
      isConnectionValid = false;
      reply.raw.write(
        'event: error\ndata: {"error": "Token expired", "code": "TOKEN_EXPIRED"}\n\n',
      );
      reply.raw.end();
      return;
    }

    // Fetch and send metrics
    const metrics = await getMetrics(user.id);
    reply.raw.write(`data: ${JSON.stringify(metrics)}\n\n`);
  };

  await sendMetrics();
  const interval = setInterval(async () => {
    if (!isConnectionValid) {
      clearInterval(interval);
      return;
    }
    await sendMetrics();
  }, 5000);

  request.raw.on('close', () => {
    isConnectionValid = false;
    clearInterval(interval);
  });

  return reply;
});
```

### Logs Stream Handler

```typescript
fastify.get('/deployments/:id/logs/stream', async (request, reply) => {
  const { id } = request.params;
  const user = request.user;

  // Verify ownership
  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: { service: true },
  });

  if (!deployment || deployment.service.userId !== user.id) {
    return reply.status(404).send({ error: 'Not found' });
  }

  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let isConnectionValid = true;

  // Periodic token validation
  const tokenValidationInterval = setInterval(async () => {
    const isValid = await validateToken(request, fastify);
    if (!isValid) {
      isConnectionValid = false;
      reply.raw.write(
        'event: error\ndata: {"error": "Token expired", "code": "TOKEN_EXPIRED"}\n\n',
      );
      reply.raw.end();
      clearInterval(tokenValidationInterval);
    }
  }, 30000);

  // Subscribe to logs
  const channel = `deployment-logs:${id}`;
  const onMessage = (chan, message) => {
    if (!isConnectionValid) return;
    if (chan === channel) {
      reply.raw.write(`data: ${message}\n\n`);
    }
  };

  redisSubscriber.subscribe(channel);
  redisSubscriber.on('message', onMessage);

  request.raw.on('close', () => {
    isConnectionValid = false;
    clearInterval(tokenValidationInterval);
    redisSubscriber.removeListener('message', onMessage);
  });

  return reply;
});
```

## Testing

### Test Coverage

Tests verify:

1. ✅ Valid tokens allow SSE connections
2. ✅ Expired tokens reject connections
3. ✅ Connections close gracefully on token expiration
4. ✅ Error events are sent to client on expiration
5. ✅ Token validation occurs periodically

### Running Tests

```bash
# Run all API tests
pnpm --filter api test

# Run only SSE token expiration tests
pnpm --filter api test sse-token-expiration
```

## Troubleshooting

### Connection Closes Immediately

**Symptom:** EventSource closes right after opening

**Possible Causes:**

1. Token is already expired
2. Token is missing from request
3. CORS configuration issue

**Solutions:**

- Check token expiration: `jwt.decode(token).exp`
- Verify `withCredentials: true` is set
- Check browser console for CORS errors

### "Session expired" Message Too Frequent

**Symptom:** User sees expiration message within seconds of login

**Possible Causes:**

1. Token `expiresIn` set too short
2. Clock skew between client and server
3. Token validation too aggressive

**Solutions:**

- Increase token expiration: `expiresIn: '7d'`
- Sync server time with NTP
- Review validation interval frequency

### Metrics Stop Updating

**Symptom:** Metrics freeze but connection stays open

**Possible Causes:**

1. Token expired but validation not triggered
2. Server error during metrics fetch
3. Docker connection issue

**Solutions:**

- Check server logs for validation failures
- Monitor Docker daemon connectivity
- Verify token is still valid

## Best Practices

1. **Token Expiration:** Set reasonable expiration (7 days is recommended)
2. **Validation Frequency:** Balance security with performance
   - High-frequency updates: validate on each cycle
   - Low-frequency updates: validate every 30-60 seconds
3. **Error Handling:** Always handle `TOKEN_EXPIRED` events on client
4. **User Experience:** Show clear messages on expiration
5. **Cleanup:** Always clear intervals and listeners on connection close
6. **Testing:** Test with short-lived tokens to verify expiration handling
7. **Logging:** Log token validation failures for security monitoring

## References

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Fastify JWT Documentation](https://github.com/fastify/fastify-jwt)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
