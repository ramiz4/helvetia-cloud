# Security Guidelines

## Table of Contents

1. [Docker Socket Security](#docker-socket-security)
2. [CORS Configuration](#cors-configuration)
3. [Docker Volume Mounts](#docker-volume-mounts)

---

## Docker Socket Security

### Overview

Direct access to the Docker socket (`/var/run/docker.sock`) provides **root-equivalent privileges** on the host system. To mitigate this critical security risk, Helvetia Cloud uses a **Docker Socket Proxy** that acts as a security layer with Access Control Lists (ACLs).

### Security Risks Mitigated

| Risk                    | Impact       | Mitigation                                          |
| ----------------------- | ------------ | --------------------------------------------------- |
| Container Escape        | **Critical** | Socket proxy prevents privileged container creation |
| Host System Compromise  | **Critical** | Read-only socket mount + ACL restrictions           |
| Privilege Escalation    | **High**     | Limited API access through proxy                    |
| Unauthorized API Access | **High**     | Only whitelisted Docker operations allowed          |

### Docker Socket Proxy Implementation

**Architecture**:

```
┌──────────┐         ┌─────────────────┐         ┌──────────┐
│  Worker  │────────>│  Socket Proxy   │────────>│  Docker  │
│Container │  HTTP   │ (tecnativa)     │  Socket │  Daemon  │
└──────────┘         └─────────────────┘         └──────────┘
                      Filters & ACLs
```

**Configuration** (`docker-compose.yml`):

- Service: `docker-socket-proxy` (tecnativa/docker-socket-proxy)
- Socket Mount: Read-only (`/var/run/docker.sock:ro`)
- Network: `helvetia-net` (shared with Worker and Traefik)
- Port: 2375 (HTTP, not exposed externally)

**Allowed Operations**:

- ✅ Build images (required for deployments)
- ✅ Create/start/stop containers (required for deployments)
- ✅ List containers and images (required for status monitoring)
- ✅ Execute commands in containers (required for builds)
- ✅ Manage networks and volumes (required for networking and persistence)

**Denied Operations**:

- ❌ Docker Swarm operations (services, tasks, swarm)
- ❌ Privileged container creation (blocked by proxy)
- ❌ Direct socket access (only proxy can access socket)

### Security Benefits

1. **API Filtering**: Only whitelisted Docker API endpoints are accessible
2. **Read-Only Socket**: Proxy mounts socket as read-only
3. **ACL Enforcement**: Fine-grained control over allowed operations
4. **Audit Trail**: All Docker API calls go through monitored proxy
5. **Defense in Depth**: Additional security layer if a service is compromised

### Configuration Details

The socket proxy is configured via environment variables in `docker-compose.yml`:

```yaml
environment:
  CONTAINERS: 1 # List, inspect containers
  POST: 1 # Create containers/exec
  BUILD: 1 # Build images
  IMAGES: 1 # Manage images
  NETWORKS: 1 # Manage networks (Traefik)
  VOLUMES: 1 # Manage volumes (persistence)
  EXEC: 1 # Execute commands
  ALLOW_START: 1 # Start containers
  ALLOW_STOP: 1 # Stop containers
  SERVICES: 0 # Deny Swarm services
  SWARM: 0 # Deny Swarm management
```

### Usage in Services

Services connect to the proxy using `DOCKER_HOST` environment variable:

```yaml
worker:
  environment:
    - DOCKER_HOST=tcp://docker-socket-proxy:2375
```

In code (automatically uses `DOCKER_HOST`):

```typescript
import Docker from 'dockerode';
const docker = new Docker(); // Connects to proxy
```

### Further Hardening

For production deployments, consider additional security measures:

1. **SELinux/AppArmor**: Mandatory Access Control policies
2. **Rootless Docker**: Run Docker daemon as non-root user
3. **Kubernetes Migration**: Use CRI instead of Docker API
4. **Network Segmentation**: Isolate socket proxy network

See [DOCKER_SECURITY_HARDENING.md](./DOCKER_SECURITY_HARDENING.md) for comprehensive security guidance.

---

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
