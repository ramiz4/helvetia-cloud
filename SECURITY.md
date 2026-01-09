# Security Guidelines

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

1. **Use a dedicated workspace directory**:

   ```bash
   WORKSPACE_DIR=/var/lib/helvetia/workspaces
   ```

2. **Set proper permissions**:

   ```bash
   sudo mkdir -p /var/lib/helvetia/workspaces
   sudo chown -R helvetia:helvetia /var/lib/helvetia/workspaces
   sudo chmod 750 /var/lib/helvetia/workspaces
   ```

3. **Enable SELinux/AppArmor labels** (if available):

   ```bash
   # SELinux example
   sudo chcon -Rt svirt_sandbox_file_t /var/lib/helvetia/workspaces
   ```

4. **Consider Docker volumes** instead of bind mounts for better isolation

5. **Implement regular cleanup**:
   - Configure automated cleanup of old workspace directories
   - Monitor disk usage
   - Set retention policies

### Security Checklist

- [ ] WORKSPACE_DIR is set to a dedicated directory
- [ ] No root directories are mounted in containers
- [ ] Workspace mounts use `:ro` (read-only) flag
- [ ] Proper file permissions are set
- [ ] Regular cleanup is configured
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
