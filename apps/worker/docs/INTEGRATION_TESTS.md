# Integration Tests for Worker Build Security

## Context

Copilot AI identified a valid concern with the existing security tests in `apps/worker/src/worker.test.ts`:

> The tests verify the workspace mount configuration and read-only flag, but don't verify that the workspace is actually being used. Since the workspace mount is currently unused (builds write to /app inside container, not /workspaces), these tests pass but don't validate actual security.

## Solution

Created comprehensive integration tests in `apps/worker/src/worker.integration.test.ts` that validate **actual build behavior** rather than just configuration.

### What the Integration Tests Verify

1. **Read-Only Mount Enforcement**
   - Attempts to write to `/workspaces` fail with "Read-only file system" error
   - Validates that the `:ro` flag actually works in practice

2. **Build Location Validation**
   - Verifies builds write to `/app` inside the container
   - Confirms `/workspaces` remains empty during builds
   - Validates the documented behavior matches reality

3. **Build Isolation**
   - Ensures build artifacts don't leak to the host workspace directory
   - Verifies the workspace directory on the host remains unchanged after builds
   - Confirms secrets and build outputs stay inside containers

4. **Filesystem Access Control**
   - Validates that dangerous host paths (`/Users`, `/home`, `/root`, `/etc`) are not mounted
   - Confirms builder containers can't access host user data
   - Verifies only Docker socket and workspace are mounted

5. **Docker Socket Security**
   - Ensures Docker socket works for building images
   - Confirms host filesystem is not accessible despite Docker socket access
   - Validates the principle of least privilege

6. **Git Clone Security**
   - Tests with real repository cloning
   - Verifies clones happen in `/app`, not `/workspaces`
   - Confirms no data leaks to mounted directories

## Test Results

All 7 integration tests pass successfully:

```
✓ src/worker.integration.test.ts (7 tests) 4122ms
  ✓ Workspace Mount Behavior (2)
    ✓ should mount workspace as read-only and prevent writes
    ✓ should verify builds write to /app inside container, not /workspaces
  ✓ Build Isolation (2)
    ✓ should not leak build artifacts to host workspace directory
    ✓ should prevent access to host filesystem paths
  ✓ Docker Socket Security (2)
    ✓ should only mount docker socket and workspace directory
    ✓ should allow docker commands via socket but not host filesystem access
  ✓ Git Clone Security (1)
    ✓ should clone repositories to /app, not /workspaces
```

## Documentation Updates

Updated `SECURITY.md` to reference both unit and integration tests:

```markdown
**Security Validation**: The workspace mount configuration is validated by both
unit tests (`apps/worker/src/worker.test.ts`) and integration tests
(`apps/worker/src/worker.integration.test.ts`). The integration tests verify:

- The workspace mount is truly read-only (write attempts fail)
- Builds actually write to `/app` inside the container, not `/workspaces`
- Build artifacts don't leak to the host workspace directory
- Host filesystem paths are not accessible from builder containers
```

## Key Differences: Unit Tests vs Integration Tests

### Unit Tests (`worker.test.ts`)

- Test configuration values
- Fast (milliseconds)
- Mock Docker and other dependencies
- Verify mount strings are correct

### Integration Tests (`worker.integration.test.ts`)

- Test actual Docker behavior
- Slower (seconds)
- Use real Docker containers
- Verify security works in practice

## Impact

This addresses Copilot AI's concern by:

1. ✅ Validating that the workspace is actually unused (as documented)
2. ✅ Confirming builds write to `/app` (as implemented)
3. ✅ Verifying no data leaks to the host
4. ✅ Testing actual security behavior, not just configuration

## Note on Pre-existing Test Failures

The workspace.test.ts file has 3 failing tests related to a `cleanupWorkspace` function that doesn't exist in the implementation. This is a pre-existing issue unrelated to our changes:

```
❯ src/utils/workspace.test.ts (12 tests | 3 failed)
  × should clean up old directories
  × should not clean up recent directories
  × should handle non-existent workspace directory gracefully
```

These tests should be removed or the `cleanupWorkspace` function should be implemented as a separate task.
