# GitHub Issues to Create - Prioritized

This document contains all issues identified in the code review, ready to be created in GitHub.
Copy each issue section below to create a new GitHub issue.

---

## 🔴 P0 - CRITICAL (Must Fix Immediately)

### Issue 1: [CRITICAL] Hardcoded Cryptographic Salt in Encryption

**Labels:** `P0`, `security`, `critical`, `bug`

**Description:**
The encryption module uses a hardcoded salt value `'salt'` for key derivation, which completely defeats the purpose of encryption and makes GitHub access tokens vulnerable to decryption.

**Location:**
`apps/api/src/utils/crypto.ts:8`

**Current Code:**

```typescript
const ENCRYPTION_KEY = crypto.scryptSync(KEY, 'salt', 32);
```

**Security Impact:**

- GitHub access tokens are vulnerable to rainbow table attacks
- If database is compromised, tokens can be easily decrypted
- Violates cryptographic best practices

**Recommended Fix:**

```typescript
const SALT = process.env.ENCRYPTION_SALT || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_KEY = crypto.scryptSync(KEY, SALT, 32);
```

**Better Solution:**
Use a proper key management service (AWS KMS, HashiCorp Vault) or at minimum, store a secure random salt in environment variables.

**Acceptance Criteria:**

- [ ] Remove hardcoded salt
- [ ] Generate unique salt per installation
- [ ] Store salt securely in environment variables
- [ ] Update .env.example with ENCRYPTION_SALT
- [ ] Document migration path for existing encrypted data
- [ ] Add tests for encryption/decryption

---

### Issue 2: [CRITICAL] Missing Rate Limiting Implementation

**Labels:** `P0`, `security`, `critical`, `enhancement`

**Description:**
Despite having rate limiting configuration in environment variables, no rate limiting is actually implemented. Critical endpoints are vulnerable to brute-force and DoS attacks.

**Vulnerable Endpoints:**

- `/auth/github` - OAuth callback (brute force risk)
- `/services/:id/deploy` - Resource-intensive operations (DoS risk)
- `/webhooks/github` - External webhook (abuse risk)
- All authenticated endpoints

**Impact:**

- Brute-force attacks on authentication
- DoS through excessive deployment requests
- Webhook spam overwhelming the system
- Resource exhaustion

**Recommended Implementation:**

```typescript
import rateLimit from '@fastify/rate-limit';

// Global rate limiting
fastify.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  redis: redisConnection,
  keyGenerator: (request) => request.ip,
});

// Stricter limit for auth routes
fastify.register(
  rateLimit,
  {
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10'),
    timeWindow: process.env.AUTH_RATE_LIMIT_WINDOW || '1 minute',
    redis: redisConnection,
  },
  { prefix: '/auth' },
);
```

**Acceptance Criteria:**

- [ ] Install @fastify/rate-limit dependency
- [ ] Implement global rate limiting
- [ ] Implement stricter limits for authentication endpoints
- [ ] Implement limits for deployment endpoints
- [ ] Implement limits for WebSocket/SSE connections
- [ ] Exclude /health endpoint from rate limiting
- [ ] Add rate limit headers in responses
- [ ] Add tests for rate limiting
- [ ] Document rate limits in API docs

---

### Issue 3: [CRITICAL] GitHub Webhook Authentication Missing

**Labels:** `P0`, `security`, `critical`, `bug`

**Description:**
GitHub webhooks endpoint (`/webhooks/github`) processes requests without verifying the signature. Anyone can trigger deployments by sending POST requests to this endpoint.

**Location:**
`apps/api/src/server.ts:979-1152`

**Current Code:**

```typescript
fastify.post('/webhooks/github', async (request) => {
  const payload = request.body as any;
  // No signature verification!
```

**Security Impact:**

- Unauthorized deployments can be triggered
- Malicious actors can cause resource exhaustion
- Preview environments can be created/destroyed without authorization
- Potential for code injection through malicious payloads

**Recommended Fix:**

```typescript
import crypto from 'crypto';

function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

fastify.post('/webhooks/github', async (request, reply) => {
  const signature = request.headers['x-hub-signature-256'] as string;

  if (!signature) {
    return reply.status(401).send({ error: 'Missing signature' });
  }

  const rawBody = JSON.stringify(request.body);

  if (!verifyGitHubSignature(rawBody, signature, process.env.GITHUB_WEBHOOK_SECRET!)) {
    return reply.status(401).send({ error: 'Invalid signature' });
  }

  // ... process webhook
});
```

**Acceptance Criteria:**

- [ ] Add GITHUB_WEBHOOK_SECRET to environment variables
- [ ] Implement signature verification function
- [ ] Add signature verification to webhook endpoint
- [ ] Return 401 for missing or invalid signatures
- [ ] Log suspicious requests
- [ ] Add tests for signature verification
- [ ] Update documentation with webhook setup instructions
- [ ] Update .env.example

---

### Issue 4: [CRITICAL] Insecure CORS Configuration Allows Origin Reflection

**Labels:** `P0`, `security`, `critical`, `bug`

**Description:**
SSE endpoints reflect the request origin back in `Access-Control-Allow-Origin` header with credentials enabled, effectively bypassing CORS protection.

**Locations:**

- `apps/api/src/server.ts:654-661` (metrics stream)
- `apps/api/src/server.ts:1199-1206` (logs stream)

**Vulnerable Code:**

```typescript
'Access-Control-Allow-Origin': request.headers.origin || '*',
'Access-Control-Allow-Credentials': 'true',
```

**Security Impact:**

- Cross-origin attacks possible
- Session hijacking risk
- CSRF vulnerabilities
- Sensitive data exposure to malicious origins

**Recommended Fix:**

```typescript
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  process.env.APP_BASE_URL ||
  'http://localhost:3000'
)
  .split(',')
  .map((o) => o.trim());

fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});

// For SSE endpoints
reply.raw.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
  'Access-Control-Allow-Origin': allowedOrigins.includes(request.headers.origin || '')
    ? request.headers.origin
    : allowedOrigins[0],
  'Access-Control-Allow-Credentials': 'true',
});
```

**Acceptance Criteria:**

- [ ] Add ALLOWED_ORIGINS environment variable
- [ ] Implement strict origin validation
- [ ] Fix CORS configuration in server setup
- [ ] Fix CORS headers in SSE endpoints
- [ ] Remove wildcard origin fallback
- [ ] Add tests for CORS validation
- [ ] Document CORS configuration
- [ ] Update .env.example

---

### Issue 5: [CRITICAL] Host Filesystem Exposure via Docker Volume Mount

**Labels:** `P0`, `security`, `critical`, `bug`

**Description:**
Worker mounts the entire `/Users` directory into builder containers, exposing all user data on macOS. This is extremely dangerous.

**Location:**
`apps/worker/src/worker.ts:104, 216`

**Vulnerable Code:**

```typescript
Binds: ['/var/run/docker.sock:/var/run/docker.sock', '/Users:/Users'],
```

**Security Impact:**

- Container can access all user data on macOS
- Host filesystem can be modified by container
- Privilege escalation possible
- Violates principle of least privilege
- Data breach risk

**Recommended Fix:**

```typescript
// Only mount specific workspace directory, read-only
const workDir = process.env.WORKSPACE_DIR || '/tmp/helvetia-workspaces';

// Ensure directory exists
await fs.promises.mkdir(workDir, { recursive: true });

Binds: [
  '/var/run/docker.sock:/var/run/docker.sock',
  `${workDir}:/workspaces:ro`, // Read-only mount
],
```

**Additional Security:**

- Use temporary directories that are cleaned up
- Never mount root directories
- Use SELinux/AppArmor labels
- Consider using Docker volumes instead of bind mounts

**Acceptance Criteria:**

- [ ] Remove /Users mount completely
- [ ] Create dedicated workspace directory
- [ ] Mount workspace as read-only
- [ ] Add WORKSPACE_DIR environment variable
- [ ] Implement workspace cleanup
- [ ] Add documentation warning about production usage
- [ ] Add tests to verify mount configuration
- [ ] Update .env.example

---

## 🟠 P1 - HIGH PRIORITY (Fix Soon)

### Issue 6: [HIGH] SQL Injection Risk with Prisma String Operations

**Labels:** `P1`, `security`, `bug`

**Description:**
Using `contains` with unsanitized user input in Prisma queries could be vulnerable to SQL injection or at minimum, unexpected behavior.

**Location:**
Multiple locations in `apps/api/src/server.ts`

**Example:**

```typescript
where: {
  repoUrl: {
    contains: repoUrl;
  }
}
```

**Recommended Fix:**

```typescript
const sanitizedRepoUrl = repoUrl.trim().replace(/\.git$/, '');
where: {
  OR: [{ repoUrl: sanitizedRepoUrl }, { repoUrl: `${sanitizedRepoUrl}.git` }];
}
```

**Acceptance Criteria:**

- [ ] Audit all Prisma queries using user input
- [ ] Sanitize repo URLs before querying
- [ ] Use exact matches where possible
- [ ] Add input validation tests
- [ ] Document safe query patterns

---

### Issue 7: [HIGH] Missing Comprehensive Input Validation

**Labels:** `P1`, `security`, `enhancement`

**Description:**
Service creation and update endpoints lack comprehensive input validation, allowing potentially malicious or malformed data.

**Location:**
`apps/api/src/server.ts:500-597`

**Missing Validations:**

- Service name format (could contain special characters)
- URL validation for repoUrl
- Command injection prevention for buildCommand/startCommand
- Size limits for envVars
- Branch name validation

**Recommended Implementation:**
Use Zod for schema validation:

```typescript
import { z } from 'zod';

const ServiceCreateSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9-]+$/),
  repoUrl: z.string().url().optional(),
  branch: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9-_./]+$/),
  buildCommand: z.string().max(1000).optional(),
  startCommand: z.string().max(1000).optional(),
  port: z.number().int().min(1).max(65535),
  envVars: z.record(z.string()).optional(),
  customDomain: z.string().max(255).optional(),
  type: z.enum(['DOCKER', 'STATIC', 'POSTGRES', 'REDIS', 'MYSQL', 'COMPOSE']),
  staticOutputDir: z.string().max(255).optional(),
});
```

**Acceptance Criteria:**

- [ ] Install zod dependency
- [ ] Create validation schemas for all endpoints
- [ ] Implement request validation middleware
- [ ] Return detailed validation errors
- [ ] Add tests for validation
- [ ] Document API request/response schemas

---

### Issue 8: [HIGH] SSE Connection Token Expiration Not Handled

**Labels:** `P1`, `security`, `bug`

**Description:**
Long-lived SSE connections don't re-validate JWT tokens, potentially allowing access after token expiration.

**Locations:**

- `apps/api/src/server.ts:650-705` (metrics)
- `apps/api/src/server.ts:1184-1230` (logs)

**Recommended Fix:**
Implement periodic token validation in SSE streams.

**Acceptance Criteria:**

- [ ] Add periodic token validation (every 5 minutes)
- [ ] Close connection on token expiration
- [ ] Implement graceful reconnection on client side
- [ ] Add tests for token expiration handling
- [ ] Document SSE connection lifecycle

---

### Issue 9: [HIGH] Incomplete Error Handling in Worker Deployment

**Labels:** `P1`, `bug`, `reliability`

**Description:**
Worker's catch block doesn't handle partial failures properly. Resources may not be cleaned up correctly on deployment failure.

**Location:**
`apps/worker/src/worker.ts:435-445`

**Issues:**

- Builder container might not be cleaned up
- Old containers might not be restarted on rollback
- No rollback mechanism for failed deployments

**Acceptance Criteria:**

- [ ] Implement comprehensive cleanup in catch block
- [ ] Add rollback to previous container on failure
- [ ] Ensure builder container always cleaned up
- [ ] Log detailed error information
- [ ] Add tests for failure scenarios
- [ ] Update deployment status correctly on all paths

---

### Issue 10: [HIGH] Race Condition in Service Status Updates

**Labels:** `P1`, `bug`, `concurrency`

**Description:**
Service status is updated from multiple places without synchronization, leading to race conditions and stale data.

**Locations:**

- API sets status to DEPLOYING when queuing
- Worker sets status after deployment
- Docker status checked asynchronously

**Recommended Solution:**
Implement Redis-based distributed locks using Redlock.

**Acceptance Criteria:**

- [ ] Install redlock dependency
- [ ] Implement distributed locking for status updates
- [ ] Create status reconciliation service
- [ ] Add tests for concurrent updates
- [ ] Document status lifecycle

---

### Issue 11: [HIGH] Docker Socket Security Risk

**Labels:** `P1`, `security`, `architecture`

**Description:**
Direct Docker socket access in both API and Worker provides root-level access to host system.

**Impact:**

- Container escape vulnerabilities
- Host system compromise potential
- Privilege escalation risks

**Recommended Solutions:**

1. Run Docker daemon in rootless mode
2. Implement Docker socket proxy with ACLs
3. Consider migrating to Kubernetes

**Acceptance Criteria:**

- [ ] Document security implications
- [ ] Implement Docker socket proxy
- [ ] Add SELinux/AppArmor policies
- [ ] Create security hardening guide
- [ ] Consider Kubernetes migration path

---

### Issue 12: [HIGH] Memory Leak Risk in SSE Connections

**Labels:** `P1`, `bug`, `performance`

**Description:**
SSE connection intervals may not be properly cleaned up on errors, leading to memory leaks.

**Location:**
`apps/api/src/server.ts:650-705`

**Recommended Fix:**
Add comprehensive error handling and cleanup.

**Acceptance Criteria:**

- [ ] Add error handling in interval callbacks
- [ ] Ensure cleanup on all error paths
- [ ] Add connection state tracking
- [ ] Implement connection timeout
- [ ] Add tests for error scenarios
- [ ] Monitor memory usage

---

### Issue 13: [HIGH] Unrestricted Service Deletion Risk

**Labels:** `P1`, `bug`, `data-loss`

**Description:**
Service deletion is permanent and irreversible without safety mechanisms.

**Recommended Implementation:**
Implement soft deletion with retention period.

**Acceptance Criteria:**

- [ ] Add deletedAt field to Service model
- [ ] Implement soft deletion
- [ ] Add delete protection flag
- [ ] Schedule cleanup after retention period
- [ ] Add recovery mechanism
- [ ] Require re-authentication for deletion
- [ ] Add tests for deletion flow

---

## 🟡 P2 - MEDIUM PRIORITY (Plan to Address)

### Issue 14: [MEDIUM] Missing Dockerfile Generation Validation

**Labels:** `P2`, `enhancement`, `reliability`

**Description:**
Generated Dockerfiles aren't validated before build, leading to hard-to-debug failures.

**Location:**
`apps/worker/src/worker.ts:225-310`

**Acceptance Criteria:**

- [ ] Add Dockerfile syntax validation
- [ ] Implement dry-run before build
- [ ] Validate environment variable format
- [ ] Add better error messages
- [ ] Add tests for various scenarios

---

### Issue 15: [MEDIUM] Hardcoded Magic Numbers Throughout Codebase

**Labels:** `P2`, `refactoring`, `maintainability`

**Description:**
Magic numbers scattered throughout code reduce maintainability.

**Examples:**

- `512 * 1024 * 1024` (Memory limit)
- `1000000000` (CPU limit)
- `5000` (Metrics interval)

**Acceptance Criteria:**

- [ ] Create constants configuration file
- [ ] Extract all magic numbers
- [ ] Make limits configurable via env vars
- [ ] Update documentation
- [ ] Add tests with different configurations

---

### Issue 16: [MEDIUM] Missing Request/Response Logging

**Labels:** `P2`, `observability`, `enhancement`

**Description:**
No structured logging for requests and responses, making debugging difficult.

**Acceptance Criteria:**

- [ ] Implement request logging hook
- [ ] Implement response logging hook
- [ ] Add structured logging with context
- [ ] Configure log levels per environment
- [ ] Add request ID correlation
- [ ] Document logging format

---

### Issue 17: [MEDIUM] No Health Check Endpoint for Worker

**Labels:** `P2`, `observability`, `enhancement`

**Description:**
Worker service lacks health check endpoint for monitoring.

**Acceptance Criteria:**

- [ ] Add HTTP health endpoint
- [ ] Include queue stats
- [ ] Include Redis connection status
- [ ] Include uptime information
- [ ] Document health check format
- [ ] Add monitoring setup guide

---

### Issue 18: [MEDIUM] Incomplete Test Coverage

**Labels:** `P2`, `testing`, `quality`

**Description:**
Test suite exists but critical paths aren't fully covered.

**Missing Tests:**

- Integration tests for deployment flow
- Webhook processing tests
- SSE streaming tests
- Worker deployment tests (currently failing)

**Acceptance Criteria:**

- [ ] Fix failing worker tests
- [ ] Add integration tests
- [ ] Achieve 80% code coverage minimum
- [ ] Add E2E tests for critical flows
- [ ] Set up test containers for integration tests
- [ ] Add coverage reporting to CI

---

### Issue 19: [MEDIUM] Environment Variable Management Needs Improvement

**Labels:** `P2`, `enhancement`, `configuration`

**Description:**
No validation for required environment variables, leading to potential runtime errors.

**Acceptance Criteria:**

- [ ] Install zod for validation
- [ ] Create environment schema
- [ ] Validate on startup
- [ ] Provide clear error messages
- [ ] Add type safety for env vars
- [ ] Update documentation

---

### Issue 20: [MEDIUM] No Database Migration Strategy

**Labels:** `P2`, `database`, `deployment`

**Description:**
Using `db:push` instead of migrations is dangerous for production.

**Issues:**

- No migration history
- Can cause data loss
- Can't rollback changes
- No team collaboration on schema changes

**Acceptance Criteria:**

- [ ] Switch to Prisma Migrate
- [ ] Create initial migration
- [ ] Update deployment scripts
- [ ] Document migration workflow
- [ ] Add rollback procedures
- [ ] Update CI/CD pipeline

---

### Issue 21: [MEDIUM] Frontend State Management Issues

**Labels:** `P2`, `frontend`, `performance`

**Description:**
Dashboard has performance issues and state management anti-patterns.

**Issues:**

- Services fetched on every re-render
- No caching mechanism
- Large component needs splitting
- Optimistic updates without proper rollback

**Acceptance Criteria:**

- [ ] Install React Query or SWR
- [ ] Implement data caching
- [ ] Split large components
- [ ] Add error boundaries
- [ ] Implement proper loading states
- [ ] Add tests for state management

---

### Issue 22: [MEDIUM] Docker Image Cleanup Missing

**Labels:** `P2`, `infrastructure`, `resource-management`

**Description:**
No cleanup for dangling, failed, or old Docker images, leading to disk space issues.

**Acceptance Criteria:**

- [ ] Implement periodic cleanup job
- [ ] Remove dangling images
- [ ] Remove old image versions
- [ ] Add retention policy
- [ ] Monitor disk usage
- [ ] Add configuration options

---

### Issue 23: [MEDIUM] Missing Prometheus Metrics

**Labels:** `P2`, `observability`, `monitoring`

**Description:**
No metrics exported for system monitoring.

**Needed Metrics:**

- Request rates and latencies
- Error rates
- Deployment success/failure rates
- Queue depths
- Resource usage

**Acceptance Criteria:**

- [ ] Install prom-client
- [ ] Add /metrics endpoint
- [ ] Implement custom metrics
- [ ] Add Grafana dashboard
- [ ] Document metrics
- [ ] Set up alerting

---

### Issue 24: [MEDIUM] Session Management Needs Refresh Tokens

**Labels:** `P2`, `security`, `enhancement`

**Description:**
JWT tokens have 7-day expiration with no refresh mechanism.

**Acceptance Criteria:**

- [ ] Implement refresh token flow
- [ ] Use short-lived access tokens (15 min)
- [ ] Implement token rotation
- [ ] Add token revocation list in Redis
- [ ] Update frontend to handle refresh
- [ ] Add tests for token lifecycle

---

### Issue 25: [MEDIUM] No Request Size Limits

**Labels:** `P2`, `security`, `performance`

**Description:**
Missing request body size limits could allow DoS attacks.

**Acceptance Criteria:**

- [ ] Add body size limit to Fastify config
- [ ] Configure appropriate limits (10MB default)
- [ ] Add limits per endpoint type
- [ ] Document size limits
- [ ] Add tests for size validation
- [ ] Return appropriate error messages

---

## 🟢 P3 - LOW PRIORITY (Nice to Have)

### Issue 26: [LOW] Excessive TypeScript `any` Usage

**Labels:** `P3`, `refactoring`, `type-safety`

**Description:**
Extensive use of `any` type reduces type safety benefits.

**Acceptance Criteria:**

- [ ] Add Fastify type augmentation
- [ ] Create proper request/response types
- [ ] Remove `as any` casts
- [ ] Enable stricter TypeScript checks
- [ ] Document type patterns

---

### Issue 27: [LOW] Inconsistent Error Messages

**Labels:** `P3`, `ux`, `enhancement`

**Description:**
Error messages aren't user-friendly or consistent.

**Acceptance Criteria:**

- [ ] Create error response standard
- [ ] Add error codes
- [ ] Make messages user-friendly
- [ ] Add i18n support for errors
- [ ] Document error codes
- [ ] Update frontend error handling

---

### Issue 28: [LOW] Missing API Versioning

**Labels:** `P3`, `api`, `architecture`

**Description:**
No API versioning strategy makes future changes risky.

**Acceptance Criteria:**

- [ ] Add version prefix (/api/v1)
- [ ] Document versioning strategy
- [ ] Plan v2 transition path
- [ ] Update frontend API calls
- [ ] Add version negotiation

---

### Issue 29: [LOW] No Request ID Tracing

**Labels:** `P3`, `observability`, `enhancement`

**Description:**
Missing correlation IDs makes request tracing difficult.

**Acceptance Criteria:**

- [ ] Add request ID generation
- [ ] Propagate IDs across services
- [ ] Include in all log entries
- [ ] Return in response headers
- [ ] Document tracing setup

---

### Issue 30: [LOW] Lack of Feature Flags

**Labels:** `P3`, `deployment`, `enhancement`

**Description:**
No way to enable/disable features without deployment.

**Acceptance Criteria:**

- [ ] Choose feature flag service
- [ ] Implement feature flag checks
- [ ] Add admin UI for flags
- [ ] Document feature flag usage
- [ ] Add A/B testing capability

---

### Issue 31: [LOW] No Graceful Shutdown

**Labels:** `P3`, `reliability`, `enhancement`

**Description:**
Services don't handle SIGTERM/SIGINT gracefully.

**Acceptance Criteria:**

- [ ] Implement graceful shutdown
- [ ] Wait for in-flight requests
- [ ] Close connections properly
- [ ] Update deployment docs
- [ ] Add tests for shutdown

---

### Issue 32: [LOW] Dashboard Accessibility Issues

**Labels:** `P3`, `accessibility`, `a11y`, `frontend`

**Description:**
Several accessibility improvements needed for WCAG compliance.

**Issues:**

- Missing ARIA labels
- Insufficient color contrast
- No keyboard navigation hints
- Modal focus trap not complete

**Acceptance Criteria:**

- [ ] Run axe-core audit
- [ ] Fix all critical a11y issues
- [ ] Add ARIA labels
- [ ] Improve color contrast
- [ ] Implement proper focus management
- [ ] Add keyboard navigation
- [ ] Test with screen readers

---

## Summary

**Total Issues:** 32

- **Critical (P0):** 5
- **High (P1):** 8
- **Medium (P2):** 12
- **Low (P3):** 7

**Recommended Timeline:**

- **Week 1:** Fix all P0 issues
- **Weeks 2-3:** Address P1 issues
- **Weeks 4-6:** Work through P2 issues
- **Ongoing:** Gradually address P3 issues

**Note:** These issues should be created in GitHub with appropriate labels, milestones, and assignments. Consider creating a project board to track progress.
