# SSE and Status Management

## Overview

This document covers Server-Sent Events (SSE) implementation for real-time updates, memory leak prevention measures, and distributed status management using Redis locks.

---

## Table of Contents

1. [SSE Connection Lifecycle](#sse-connection-lifecycle)
2. [Redis Pub/Sub Pattern](#redis-pubsub-pattern)
3. [Memory Leak Prevention](#memory-leak-prevention)
4. [Service Status Lifecycle](#service-status-lifecycle)
5. [Testing and Monitoring](#testing-and-monitoring)

---

## SSE Connection Lifecycle

### SSE Endpoints

#### 1. Metrics Stream: `/services/metrics/stream`

**Purpose:** Provides real-time container metrics (CPU, memory, status) for all user services.

**Update Frequency:** Every 5 seconds

**Authentication:** Requires valid JWT token

**Features:**

- Token validation on every metrics update cycle
- Graceful connection closure on token expiration
- Automatic client-side reconnection handling

#### 2. Deployment Logs Stream: `/deployments/:id/logs/stream`

**Purpose:** Streams live deployment logs during build and deployment process.

**Update Frequency:** Real-time (as logs are generated)

**Authentication:** Requires valid JWT token + deployment ownership verification

**Features:**

- Periodic token validation (every 30 seconds)
- Graceful connection closure on token expiration
- Automatic client-side reconnection handling

### Token Configuration

JWT tokens are configured with the following settings:

```javascript
{
  secret: process.env.JWT_SECRET || 'supersecret',
  sign: {
    expiresIn: '7d' // Tokens expire after 7 days
  }
}
```

### Connection Lifecycle

#### 1. Connection Establishment

**Client Request:**

```typescript
const eventSource = new EventSource('/services/metrics/stream', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

**Server Response:**

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

#### 2. Token Validation

**Metrics Stream** validates tokens every cycle (5 seconds):

```typescript
// On every metrics update
const decoded = fastify.jwt.verify(token);
if (tokenIsExpired(decoded)) {
  reply.raw.write('event: token-expired\ndata: {}\n\n');
  cleanup();
  return;
}
```

**Logs Stream** validates tokens every 30 seconds:

```typescript
setInterval(async () => {
  try {
    await fastify.jwt.verify(token);
  } catch (error) {
    reply.raw.write('event: token-expired\ndata: {}\n\n');
    cleanup();
  }
}, 30000);
```

#### 3. Connection Termination

Connections can be terminated in several ways:

1. **Client Disconnect**
   - Triggered by `reply.raw.on('close')` event
   - Cleanup function called automatically

2. **Token Expiration**
   - Server sends `token-expired` event
   - Client receives event and can refresh token
   - Connection closed gracefully

3. **Server Error**
   - Error caught in cleanup handler
   - Resources freed automatically

4. **Timeout (30 minutes)**
   - Automatic timeout to prevent stale connections
   - Cleanup function called after timeout

---

## Redis Pub/Sub Pattern

### Overview

The deployment logs streaming endpoint uses Redis pub/sub to receive real-time logs from the worker service. Proper connection management is critical to prevent memory leaks and subscription issues.

### Best Practices for Redis Pub/Sub

#### 1. Use Dedicated Connections

Redis pub/sub requires dedicated connections because:

- A connection in subscribe mode cannot execute other commands
- Sharing connections can cause subscription management issues
- Proper cleanup requires closing the dedicated connection

**Implementation:**

```typescript
// Create dedicated subscriber connection using duplicate()
const subConnection = request.server.redis.duplicate();
const channel = `deployment-logs:${id}`;

// Track connection health
let connectionHealthy = true;
subConnection.on('error', (err) => {
  connectionHealthy = false;
  console.error(`Redis subscription connection error:`, err);
});
```

#### 2. Proper Cleanup Pattern

Always clean up both the subscription and the dedicated connection:

```typescript
const cleanup = async () => {
  // Unsubscribe from channel
  if (isSubscribed) {
    try {
      subConnection.removeListener('message', onMessage);
      await subConnection.unsubscribe(channel);
      isSubscribed = false;
    } catch (err) {
      console.error(`Error unsubscribing:`, err);
    }
  }

  // Close the dedicated connection
  try {
    await subConnection.quit();
  } catch (err) {
    console.error(`Error closing Redis connection:`, err);
  }
};
```

#### 3. Connection Health Monitoring

Monitor connection health to detect issues early:

```typescript
let connectionHealthy = true;

subConnection.on('error', (err) => {
  connectionHealthy = false;
  console.error(`Redis connection error:`, err);
});

// Include health status in cleanup logs
console.log(`Connection cleaned up. Health: ${connectionHealthy}`);
```

#### 4. Channel Naming Convention

Use consistent channel naming patterns:

- Deployment logs: `deployment-logs:${deploymentId}`
- Status updates: `status:${serviceId}`

### Publishing Pattern (Worker)

The worker service publishes logs to Redis:

```typescript
import { Redis } from 'ioredis';

// Use the main Redis connection for publishing
const redis = new Redis(process.env.REDIS_URL);

// Publish logs to channel
await redis.publish(`deployment-logs:${deploymentId}`, logMessage);
```

### Subscribing Pattern (API)

The API subscribes to channels using dedicated connections:

```typescript
// Create dedicated connection for subscribing
const subConnection = fastify.redis.duplicate();
const channel = `deployment-logs:${deploymentId}`;

// Subscribe to channel
await subConnection.subscribe(channel);

// Handle messages
subConnection.on('message', (chan, message) => {
  if (chan === channel) {
    // Process message
    reply.raw.write(`data: ${message}\n\n`);
  }
});

// Clean up on disconnect
request.raw.on('close', async () => {
  await subConnection.unsubscribe(channel);
  await subConnection.quit();
});
```

### Common Pitfalls to Avoid

1. **Sharing connections** - Never use the main Redis connection for pub/sub
2. **Missing cleanup** - Always close dedicated connections with `quit()`
3. **Ignoring errors** - Monitor connection errors and reconnect if needed
4. **Memory leaks** - Ensure cleanup runs on all disconnect scenarios

---

## Memory Leak Prevention

### Issue

SSE connection intervals were not properly cleaned up on errors, leading to potential memory leaks.

### Root Cause Analysis

1. **Metrics Stream** (`/services/metrics/stream`):
   - `setInterval` created at line 1021 was only cleared on normal client disconnect
   - Errors in `sendMetrics()` were caught but didn't clean up the interval
   - No timeout mechanism for stale connections
   - Limited connection state tracking

2. **Logs Stream** (`/deployments/:id/logs/stream`):
   - Token validation interval created at line 1549 was only cleared on token expiration
   - Redis subscription could leak if cleanup failed
   - Shared Redis connection for pub/sub could cause subscription management issues
   - No timeout mechanism
   - Limited error handling in write operations

3. **General Issues**:
   - No comprehensive error handling in callbacks
   - Missing cleanup on error paths
   - No connection timeout to prevent indefinite connections
   - Limited observability for debugging

### Solution Implemented

#### 1. Centralized Cleanup Function

Both endpoints now have a centralized `cleanup()` function that ensures all resources are freed:

```typescript
const cleanup = async () => {
  if (!connectionState.isValid) return; // Idempotent

  connectionState.isValid = false;

  // Clear all intervals
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }

  // Clear all timeouts
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }

  // Unsubscribe from Redis and close dedicated connection
  if (isSubscribed) {
    try {
      subConnection.removeListener('message', onMessage);
      await subConnection.unsubscribe(channel);
      isSubscribed = false;
    } catch (err) {
      console.error(`Error unsubscribing from channel ${channel}:`, err);
    }
  }

  // Close the dedicated Redis connection
  try {
    await subConnection.quit();
  } catch (err) {
    console.error(`Error closing Redis connection:`, err);
  }

  // Close response stream
  if (!reply.raw.destroyed) {
    reply.raw.end();
  }

  fastify.log.info({ reqId }, 'SSE connection cleaned up');
};
```

#### 2. Connection State Tracking

```typescript
const connectionState = {
  isValid: true,
  startTime: Date.now(),
  lastActivity: Date.now(),
};
```

#### 3. Automatic Timeout

```typescript
const timeoutHandle = setTimeout(
  () => {
    fastify.log.warn({ reqId }, 'SSE connection timeout (30 minutes)');
    cleanup();
  },
  30 * 60 * 1000,
); // 30 minutes
```

#### 4. Comprehensive Error Handling

```typescript
reply.raw.on('error', (error) => {
  fastify.log.error({ reqId, error }, 'SSE stream error');
  cleanup();
});

reply.raw.on('close', () => {
  fastify.log.info({ reqId }, 'Client disconnected from SSE stream');
  cleanup();
});
```

#### 5. Safe Write Operations

```typescript
const safeWrite = (data: string): boolean => {
  if (!connectionState.isValid || reply.raw.destroyed) {
    return false;
  }

  try {
    reply.raw.write(data);
    connectionState.lastActivity = Date.now();
    return true;
  } catch (error) {
    fastify.log.error({ reqId, error }, 'Failed to write to SSE stream');
    cleanup();
    return false;
  }
};
```

### Testing Memory Leaks

Run the following test to verify memory leak fixes:

```bash
# Start the API
pnpm --filter api dev

# In another terminal, simulate multiple connections
for i in {1..100}; do
  curl -N -H "Authorization: Bearer $TOKEN" \
    http://localhost:3001/services/metrics/stream &
  sleep 0.1
done

# Kill all curl processes after 10 seconds
sleep 10
killall curl

# Check memory usage
docker stats api --no-stream
```

**Expected Result:** Memory should return to baseline after connections close.

---

## Service Status Lifecycle

### Overview

Service status updates in Helvetia Cloud are protected by distributed locks using Redlock algorithm to prevent race conditions when multiple components (API, Worker, reconciliation service) attempt to update status simultaneously.

### Status States

A service can be in one of the following states:

- **IDLE** - Service exists but has never been deployed
- **DEPLOYING** - Deployment is in progress (queued or building)
- **RUNNING** - Service container is running successfully
- **STOPPED** - Service container exists but is not running
- **FAILED** - Latest deployment failed and no containers are running
- **CRASHING** - Service container is repeatedly restarting

### Status Update Locations

#### 1. API Server (apps/api/src/server.ts)

**When:** User triggers a deployment via POST /services/:id/deploy

**Action:** Sets status to `DEPLOYING` with distributed lock

```typescript
await withStatusLock(id, async () => {
  await prisma.service.update({
    where: { id },
    data: { status: 'DEPLOYING' },
  });
});
```

#### 2. Worker Service (apps/worker/src/worker.ts)

**When:** Deployment job completes (success or failure)

**Actions:**

- On success: Sets status to `RUNNING` with distributed lock
- On failure with rollback: Sets status to `RUNNING` with distributed lock
- On failure without rollback: Sets status to `FAILED` with distributed lock

```typescript
await withStatusLock(serviceId, async () => {
  await prisma.service.update({
    where: { id: serviceId },
    data: { status: 'RUNNING' }, // or 'FAILED'
  });
});
```

#### 3. Status Reconciliation Service (apps/api/src/utils/statusReconciliation.ts)

**When:** Periodic reconciliation (every 30 seconds)

**Action:** Updates status based on actual container state

```typescript
await withStatusLock(serviceId, async () => {
  const container = await docker.getContainer(containerName);
  const { State } = await container.inspect();

  let newStatus: ServiceStatus;
  if (State.Running) {
    newStatus = 'RUNNING';
  } else if (State.Restarting) {
    newStatus = 'CRASHING';
  } else {
    newStatus = 'STOPPED';
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: { status: newStatus },
  });
});
```

### Distributed Locking Implementation

#### Lock Configuration

```typescript
// apps/api/src/utils/statusLock.ts
import Redlock from 'redlock';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const redlock = new Redlock([redis], {
  driftFactor: 0.01,
  retryCount: 10,
  retryDelay: 200,
  retryJitter: 200,
});
```

#### Lock Usage

```typescript
export async function withStatusLock<T>(serviceId: string, callback: () => Promise<T>): Promise<T> {
  const lockKey = `status:lock:${serviceId}`;
  const lockTTL = 5000; // 5 seconds

  const lock = await redlock.acquire([lockKey], lockTTL);

  try {
    return await callback();
  } finally {
    await lock.release();
  }
}
```

### Race Condition Prevention

**Scenario:** Worker completes deployment while reconciliation service checks status

**Without Lock:**

```
Time  | Worker              | Reconciliation     | Final Status
------|---------------------|-------------------|-------------
T+0   | Read: DEPLOYING     | Read: DEPLOYING   |
T+1   | Write: RUNNING      |                   | RUNNING
T+2   |                     | Write: STOPPED    | STOPPED ❌
```

**With Lock:**

```
Time  | Worker              | Reconciliation     | Final Status
------|---------------------|-------------------|-------------
T+0   | Acquire lock        | Wait for lock     |
T+1   | Read: DEPLOYING     |                   |
T+2   | Write: RUNNING      |                   |
T+3   | Release lock        |                   | RUNNING
T+4   |                     | Acquire lock      |
T+5   |                     | Read: RUNNING     |
T+6   |                     | Keep: RUNNING     | RUNNING ✅
```

### Status Transition Matrix

| Current Status | Allowed Next States          | Trigger                          |
| -------------- | ---------------------------- | -------------------------------- |
| IDLE           | DEPLOYING                    | User deploys                     |
| DEPLOYING      | RUNNING, FAILED              | Deployment completes             |
| RUNNING        | DEPLOYING, STOPPED, CRASHING | User redeploys, container stops  |
| STOPPED        | DEPLOYING, RUNNING           | User redeploys, container starts |
| FAILED         | DEPLOYING                    | User retries deployment          |
| CRASHING       | RUNNING, STOPPED, FAILED     | Container stabilizes or fails    |

### Lock Performance Considerations

- **Lock Duration**: 5 seconds maximum (should complete in <100ms)
- **Retry Strategy**: Up to 10 retries with 200ms delay + jitter
- **Lock Granularity**: Per-service (fine-grained to minimize contention)
- **Lock Timeout**: Automatically released after TTL expires

---

## Testing and Monitoring

### Manual Testing

#### Test SSE Connection

```bash
# Get a valid JWT token
TOKEN="your_jwt_token_here"

# Test metrics stream
curl -N -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/services/metrics/stream

# Test logs stream
DEPLOYMENT_ID="deployment_id_here"
curl -N -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/deployments/${DEPLOYMENT_ID}/logs/stream"
```

#### Test Token Expiration

```bash
# Use an expired token
EXPIRED_TOKEN="expired_token_here"

curl -N -H "Authorization: Bearer $EXPIRED_TOKEN" \
  http://localhost:3001/services/metrics/stream

# Should receive: event: token-expired
```

#### Test Status Locking

```bash
# Trigger multiple concurrent deployments
for i in {1..5}; do
  curl -X POST -H "Authorization: Bearer $TOKEN" \
    http://localhost:3001/services/$SERVICE_ID/deploy &
done

# All should succeed without race conditions
wait
```

### Automated Tests

```bash
# Run SSE tests
pnpm --filter api test src/sse.integration.test.ts

# Run status lock tests
pnpm --filter api test src/utils/statusLock.test.ts

# Run memory leak tests
pnpm --filter api test src/sse-token-expiration.test.ts
```

### Monitoring

#### Metrics to Monitor

1. **Active SSE Connections**
   - Track number of open connections
   - Alert if exceeds expected threshold

2. **Memory Usage**
   - Monitor API server memory over time
   - Alert on unexpected growth

3. **Lock Acquisition Time**
   - Track time to acquire status locks
   - Alert on slow lock operations (>500ms)

4. **Lock Contention**
   - Monitor lock retry count
   - Alert on high contention (>5 retries)

#### Logging

SSE connections log the following events:

```
INFO: SSE connection established (reqId: xxx, userId: xxx)
INFO: Token validated successfully (reqId: xxx)
WARN: Token expired, closing connection (reqId: xxx)
INFO: Client disconnected from SSE stream (reqId: xxx)
INFO: SSE connection cleaned up (reqId: xxx)
ERROR: SSE stream error (reqId: xxx, error: xxx)
```

Status lock operations log:

```
DEBUG: Acquiring status lock (serviceId: xxx)
DEBUG: Status lock acquired (serviceId: xxx, duration: xxxms)
DEBUG: Status lock released (serviceId: xxx)
WARN: Lock acquisition retry (serviceId: xxx, attempt: x/10)
ERROR: Failed to acquire status lock (serviceId: xxx, error: xxx)
```

---

## Best Practices

### For SSE Connections

1. **Always Implement Reconnection Logic**

   ```typescript
   const connectSSE = () => {
     const es = new EventSource('/services/metrics/stream');

     es.addEventListener('token-expired', () => {
       es.close();
       refreshToken().then(() => connectSSE());
     });

     es.onerror = () => {
       es.close();
       setTimeout(connectSSE, 5000); // Retry after 5s
     };
   };
   ```

2. **Handle Token Refresh**
   - Implement token refresh before expiration
   - Close and reconnect with new token

3. **Set Reasonable Timeouts**
   - Client-side timeout (e.g., 5 minutes of inactivity)
   - Server-side timeout (30 minutes maximum)

### For Status Updates

1. **Always Use Locks**

   ```typescript
   // ✅ Good
   await withStatusLock(serviceId, async () => {
     await updateStatus(serviceId, 'RUNNING');
   });

   // ❌ Bad
   await updateStatus(serviceId, 'RUNNING'); // Race condition!
   ```

2. **Keep Lock Duration Short**
   - Perform only status update within lock
   - Do expensive operations outside lock

3. **Handle Lock Failures**
   ```typescript
   try {
     await withStatusLock(serviceId, async () => {
       await updateStatus(serviceId, 'RUNNING');
     });
   } catch (error) {
     fastify.log.error({ serviceId, error }, 'Failed to acquire lock');
     // Handle gracefully - status will be reconciled eventually
   }
   ```

---

## Troubleshooting

### SSE Connection Issues

**Problem:** Connection closes immediately

**Solution:**

- Check JWT token validity
- Verify CORS settings allow SSE
- Check server logs for errors

**Problem:** No data received

**Solution:**

- Verify metrics interval is running
- Check if user has services
- Look for errors in metrics fetching

### Memory Leaks

**Problem:** API memory grows over time

**Solution:**

- Check for unclosed SSE connections
- Verify cleanup function is called
- Look for uncleared intervals/timeouts
- Run memory profiler

### Status Update Issues

**Problem:** Status stuck in wrong state

**Solution:**

- Wait for reconciliation (runs every 30s)
- Check lock acquisition logs
- Verify Docker container state
- Manually fix with database update

**Problem:** Lock acquisition timeouts

**Solution:**

- Check Redis connectivity
- Verify Redis performance
- Reduce lock TTL if appropriate
- Check for deadlocks in logs

---

## References

- [SSE Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Redlock Algorithm](https://redis.io/docs/manual/patterns/distributed-locks/)
- [Memory Leak Detection in Node.js](https://nodejs.org/en/docs/guides/simple-profiling/)
