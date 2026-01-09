# Service Status Lifecycle and Distributed Locking

## Overview

Service status updates in Helvetia Cloud are now protected by distributed locks using Redlock algorithm to prevent race conditions when multiple components (API, Worker, reconciliation service) attempt to update status simultaneously.

## Status States

A service can be in one of the following states:

- **IDLE** - Service exists but has never been deployed
- **DEPLOYING** - Deployment is in progress (queued or building)
- **RUNNING** - Service container is running successfully
- **STOPPED** - Service container exists but is not running
- **FAILED** - Latest deployment failed and no containers are running
- **CRASHING** - Service container is repeatedly restarting

## Status Update Locations

### 1. API Server (apps/api/src/server.ts)

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

### 2. Worker Service (apps/worker/src/worker.ts)

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

### 3. Status Reconciliation Service (apps/api/src/utils/statusReconciliation.ts)

**When:** Runs periodically (every 30 seconds by default)

**Action:** Reconciles status based on actual container state

```typescript
await withStatusLock(
  service.id,
  async () => {
    const expectedStatus = determineExpectedStatus(service, containers);
    if (service.status !== expectedStatus) {
      await prisma.service.update({
        where: { id: service.id },
        data: { status: expectedStatus },
      });
    }
  },
  5000,
); // 5 second lock TTL
```

## Distributed Locking Mechanism

### Implementation

We use **Redlock** algorithm with Redis as the backing store. Redlock provides:

- **Distributed coordination** across multiple API/Worker instances
- **Lock expiration** to prevent deadlocks
- **Automatic retry** with jitter to handle contention
- **Lock extension** for long-running operations

### Lock Configuration

```typescript
const redlock = new Redlock([redisClient], {
  retryCount: 10, // Max 10 retry attempts
  retryDelay: 200, // 200ms between retries
  retryJitter: 100, // Add up to 100ms random jitter
  driftFactor: 0.01, // 1% clock drift tolerance
  automaticExtensionThreshold: 500, // Auto-extend if <500ms remaining
});
```

### Lock TTL (Time To Live)

- **Default TTL:** 10 seconds (sufficient for most status updates)
- **Reconciliation TTL:** 5 seconds (shorter for periodic checks)
- **Custom TTL:** Can be specified per operation

### Usage Pattern

```typescript
// Option 1: Using withStatusLock helper (recommended)
await withStatusLock(serviceId, async () => {
  // Your status update logic here
  await prisma.service.update({ ... });
}, 10000); // Optional TTL in ms

// Option 2: Manual lock management (advanced)
const lock = await acquireStatusLock(serviceId, 10000);
try {
  // Your status update logic
  await prisma.service.update({ ... });

  // Extend lock if needed
  if (needMoreTime) {
    await extendStatusLock(lock, 5000);
  }
} finally {
  await releaseStatusLock(lock);
}
```

## Race Condition Prevention

### Problem Scenario (Before Locking)

1. API sets status to `DEPLOYING` at T=0
2. Worker completes deployment and sets to `RUNNING` at T=1
3. API's database write completes at T=2
4. **Result:** Status incorrectly shows `DEPLOYING` instead of `RUNNING`

### Solution (With Locking)

1. API acquires lock at T=0, sets status to `DEPLOYING`
2. Worker attempts to acquire lock at T=1, **waits** until lock is released
3. API releases lock at T=2
4. Worker acquires lock at T=2, sets status to `RUNNING`
5. Worker releases lock at T=3
6. **Result:** Status correctly shows `RUNNING` with no race condition

## Error Handling

### Lock Acquisition Failure

If a lock cannot be acquired after all retries (typically ~2 seconds):

```typescript
try {
  await withStatusLock(serviceId, updateFn);
} catch (error) {
  // Lock acquisition failed
  // The operation is not executed
  // Status update is skipped to maintain consistency
  console.error('Failed to acquire lock:', error);
}
```

### Lock Release Failure

Lock release failures are logged but don't throw errors, as locks will expire automatically based on TTL.

### Worker Crash

If a worker crashes while holding a lock:

- Lock expires after TTL (10 seconds)
- Reconciliation service corrects status within 30 seconds
- No manual intervention required

## Monitoring and Debugging

### Log Messages

- `Acquired lock for service {serviceId}` - Lock acquired successfully
- `Lock released successfully` - Lock released normally
- `Extended lock for {ttl}ms` - Lock TTL extended
- `Failed to acquire lock for service {serviceId}` - Lock acquisition failed
- `Redlock error:` - Redis connection or Redlock internal error

### Common Issues

1. **Status stuck in DEPLOYING**
   - Check if Worker is running
   - Check Redis connectivity
   - Wait for reconciliation service (runs every 30s)

2. **Lock acquisition timeout**
   - Multiple deployments to same service in rapid succession
   - Worker taking longer than 10s for status update
   - Normal behavior - operations will retry

3. **Redis connection errors**
   - Verify `REDIS_URL` environment variable
   - Check Redis server availability
   - Review Redlock error logs

## Best Practices

1. **Always use `withStatusLock`** for status updates
2. **Keep operations within locks short** (<10 seconds)
3. **Don't nest locks** for the same service ID
4. **Use appropriate TTL** - too short may cause lock expiration, too long delays other operations
5. **Handle lock acquisition failures gracefully** - log and continue
6. **Monitor lock acquisition times** - if consistently high, investigate contention

## Testing

Tests for concurrent status updates are located at:

- `apps/api/src/utils/statusLock.test.ts`

Run tests with:

```bash
pnpm --filter api test statusLock
```

## Configuration

### Environment Variables

- `REDIS_URL` - Redis connection string (required)

### Reconciliation Service

The reconciliation service can be configured when starting:

```typescript
// Start with custom interval (default: 30000ms)
statusReconciliationService.start(60000); // Run every 60 seconds

// Stop the service
statusReconciliationService.stop();
```

## Future Improvements

- [ ] Add metrics for lock contention
- [ ] Implement lock queuing statistics
- [ ] Add alerting for prolonged lock acquisition failures
- [ ] Consider optimistic locking for read-heavy operations
- [ ] Add lock timeout configuration via environment variables
