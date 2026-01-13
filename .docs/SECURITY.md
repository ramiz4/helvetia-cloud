# Security Guidelines

## Table of Contents

1. [Docker Socket Security](#docker-socket-security)
2. [CORS Configuration](#cors-configuration)
3. [Docker Volume Mounts](#docker-volume-mounts)
4. [Authentication and Token Security](#authentication-and-token-security)

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

---

## Authentication and Token Security

### Overview

Helvetia Cloud uses a dual-token authentication system with JWT access tokens and refresh tokens for secure user authentication. This section validates the security measures implemented in the token flow.

**Last Validated:** 2026-01-09

### Access Tokens

**Configuration:**
- **Expiration**: 15 minutes (900 seconds)
- **Storage**: httpOnly cookie
- **Secure Flag**: Enabled in production
- **SameSite**: `lax` (CSRF protection)
- **Path**: `/`

**Security Assessment:** ✅ PASS

- httpOnly flag prevents XSS attacks (tokens inaccessible to JavaScript)
- Secure flag ensures HTTPS-only transmission in production
- SameSite protection against CSRF attacks
- Short expiration window (15 min) limits exposure time

### Refresh Tokens

**Configuration:**
- **Expiration**: 30 days (2,592,000 seconds)
- **Storage**: httpOnly cookie + database
- **Generation**: `crypto.randomBytes(32)` - 256 bits entropy
- **Rotation**: Single-use tokens with immediate revocation
- **Revocation List**: Redis-based with 30-day TTL

**Security Assessment:** ✅ PASS

- Same security measures as access tokens
- Longer expiration acceptable due to rotation mechanism
- Stored securely in database with revocation capability
- Cryptographically secure PRNG for token generation
- No predictable patterns or sequential generation

### Token Generation

Implementation (`apps/api/src/utils/refreshToken.ts`):

```typescript
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

**Security Assessment:** ✅ PASS

- Uses Node.js built-in `crypto.randomBytes()` - cryptographically secure
- 32 bytes = 256 bits of entropy
- Hex encoding produces 64-character string
- No predictable patterns

### Token Rotation Mechanism

**Implementation:**
- Old refresh token immediately revoked upon successful refresh
- New refresh token issued with each refresh request
- Database tracking of token status (revoked field)
- Redis-based revocation list with 30-day TTL

**Security Assessment:** ✅ PASS

- Prevents token replay attacks
- Limits impact of token theft (single-use tokens)
- Immediate revocation ensures old tokens cannot be reused
- Dual-layer validation (database + Redis) for redundancy

**Code Location:** `apps/api/src/utils/refreshToken.ts:verifyAndRotateRefreshToken()`

### Token Revocation List

**Redis Implementation:**
- Key prefix: `revoked:refresh:{token}`
- TTL: 30 days (matching refresh token lifetime)
- Lookup: Fast O(1) operation
- Cleanup: Automatic via Redis TTL

**Security Assessment:** ✅ PASS

- Fast validation prevents performance bottlenecks
- Automatic expiration prevents memory bloat
- Centralized revocation for distributed systems
- Immediate effect across all API instances

**Code Location:** `apps/api/src/utils/refreshToken.ts:revokeRefreshToken()`

### Database Security

**RefreshToken Model Schema:**

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  revoked   Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}
```

**Security Assessment:** ✅ PASS

- Proper indexes for performance
- Cascade delete on user removal
- Unique constraint on token field
- Tracks revocation status

### JWT Configuration

**Settings** (`apps/api/src/server.ts`):

```typescript
{
  secret: process.env.JWT_SECRET,
  sign: {
    expiresIn: '15m' // 15 minutes
  },
  cookie: {
    cookieName: 'token',
    signed: false,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  }
}
```

**Security Assessment:** ✅ PASS

- JWT secret loaded from environment variable
- Short access token lifetime (15 minutes)
- Secure cookie configuration
- Production-aware secure flag

### Security Best Practices

1. **Token Storage**
   - ✅ Never store tokens in localStorage (XSS vulnerable)
   - ✅ Use httpOnly cookies (JavaScript cannot access)
   - ✅ Enable secure flag in production (HTTPS only)

2. **Token Rotation**
   - ✅ Rotate refresh tokens on every use
   - ✅ Revoke old tokens immediately
   - ✅ Use cryptographically secure random generation

3. **Token Validation**
   - ✅ Validate both database and revocation list
   - ✅ Check expiration timestamps
   - ✅ Verify user ownership

4. **Token Revocation**
   - ✅ Implement immediate revocation on logout
   - ✅ Use Redis for fast lookup
   - ✅ Set appropriate TTL for cleanup

5. **Production Deployment**
   - ⚠️ Always use HTTPS in production
   - ⚠️ Use strong JWT_SECRET (minimum 32 characters)
   - ⚠️ Monitor failed authentication attempts
   - ⚠️ Implement rate limiting on auth endpoints
   - ⚠️ Set up alerts for suspicious token usage patterns

### Testing

Run security validation tests:

```bash
# Test refresh token flow
pnpm --filter api test src/refresh-token.test.ts

# Test token validation
pnpm --filter api test src/utils/tokenValidation.ts

# Test authentication middleware
pnpm --filter api test src/middleware/auth.middleware.ts
```

### Security Checklist

- [x] Access tokens expire in 15 minutes
- [x] Refresh tokens use cryptographically secure generation
- [x] Tokens stored in httpOnly cookies
- [x] Refresh tokens rotate on every use
- [x] Revoked tokens cannot be reused
- [x] Redis revocation list with automatic cleanup
- [x] Database tracking of all tokens
- [x] Cascade delete on user removal
- [ ] Rate limiting on authentication endpoints
- [ ] Monitoring of failed authentication attempts
- [ ] Alerting on suspicious patterns

### References

- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Token Rotation Pattern](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
