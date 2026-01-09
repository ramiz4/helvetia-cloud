# Security Guidelines

## CORS Configuration

### Overview

The API uses strict CORS (Cross-Origin Resource Sharing) validation to prevent unauthorized cross-origin requests. This protects against:

- Cross-origin attacks
- Session hijacking
- CSRF vulnerabilities
- Sensitive data exposure to malicious origins

### Configuration

Set allowed origins in your `.env` file:

```bash
# Single origin
ALLOWED_ORIGINS=https://app.example.com

# Multiple origins (comma-separated)
ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com,http://localhost:3000

# Fallback to APP_BASE_URL if not set
APP_BASE_URL=http://localhost:3000
```

### Security Features

1. **Whitelist-based validation**: Only explicitly allowed origins can access the API
2. **No wildcard origins**: The `*` wildcard is never used
3. **No origin reflection**: Request origins are not blindly reflected back
4. **SSE endpoint protection**: Server-Sent Events endpoints use safe origin validation
5. **Credentials enabled**: Supports cookies and authentication headers securely

### Implementation Details

- **Framework-level blocking**: Fastify CORS plugin blocks disallowed origins before reaching route handlers
- **SSE endpoint safety**: Even if CORS is bypassed, SSE endpoints use `getSafeOrigin()` to return only whitelisted origins
- **Default behavior**: Requests with no origin (same-origin, curl, etc.) are allowed

### Testing

CORS validation is thoroughly tested in `apps/api/src/cors.test.ts`:

- Allowed origin acceptance
- Disallowed origin rejection
- Multiple origin support
- Wildcard rejection
- SSE endpoint security
- Helper function validation

### Production Recommendations

1. **Use HTTPS origins only** in production (except for local development)
2. **Minimize the allowed origins list** - only add trusted domains
3. **Never use wildcard (`*`)** with credentials enabled
4. **Review origins regularly** as your infrastructure changes
5. **Monitor CORS errors** in logs for potential attacks or misconfigurations

## Docker Volume Mounts

### ⚠️ CRITICAL: Never Mount Root Directories

**DO NOT** mount the following directories into Docker containers:

- `/` (root filesystem)
- `/Users` (macOS user directories)
- `/home` (Linux user directories)
- `/root` (root user directory)
- `/etc` (system configuration)

### ✅ Secure Configuration

The worker mounts a dedicated workspace directory, though it's currently unused:

```bash
# Set in .env
WORKSPACE_DIR=/tmp/helvetia-workspaces
```

**Current Implementation Note**: While this directory is mounted to builder containers at `/workspaces:ro`, it is **not currently used**. All builds happen inside the container's ephemeral filesystem at `/app`. The repository is cloned directly into `/app` within the container, and all build artifacts remain in the container's temporary storage.

**Security Validation**: The workspace mount configuration is validated by both unit tests (`apps/worker/src/worker.test.ts`) and integration tests (`apps/worker/src/worker.integration.test.ts`). The integration tests verify:

- The workspace mount is truly read-only (write attempts fail)
- Builds actually write to `/app` inside the container, not `/workspaces`
- Build artifacts don't leak to the host workspace directory
- Host filesystem paths are not accessible from builder containers

This directory mount provides:

- **Isolation**: Dedicated directory separate from host user data
- **Read-only**: Mounted with `:ro` flag to prevent container writes
- **Temporary**: Can be safely cleaned up (though it will remain empty)
- **Secure**: Does not expose host user data
- **Future-ready**: Available if build artifact persistence is needed later

### Production Deployment

For production environments:

1. **Monitor Docker disk usage**:
   - Builder containers and images consume disk space
   - Implement automated cleanup of old images
   - Set up disk usage alerts

2. **Enable SELinux/AppArmor labels** (if available):

   ```bash
   # SELinux example for Docker directory
   sudo semanage fcontext -a -t svirt_sandbox_file_t /var/lib/docker
   ```

3. **Consider Docker volumes** for database services for better isolation

4. **Implement regular cleanup**:
   - Configure automated cleanup of old images
   - Monitor disk usage
   - Set retention policies

### Security Checklist

- [x] No root directories are mounted in containers
- [x] Only a Docker socket and an unused, read-only workspace directory are mounted (workspace is not used by builds)
- [x] Builds happen in an isolated container filesystem
- [x] Automatic cleanup via container removal
- [ ] Resource limits are set (CPU, memory)
- [ ] Monitoring is in place

### Principle of Least Privilege

Always follow the principle of least privilege:

- Mount only what's necessary
- Use read-only mounts when possible
- Limit container capabilities
- Set resource limits (CPU, memory)
- Use non-root users in containers

### References

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
