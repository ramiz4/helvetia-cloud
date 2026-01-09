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

The worker uses an isolated build approach with **no host directory mounts**:

**Current Implementation:**

```typescript
Binds: ['/var/run/docker.sock:/var/run/docker.sock'];
```

All builds happen inside the container's ephemeral filesystem:

- **Isolated**: Repositories are cloned to `/app` inside the container
- **Ephemeral**: Build artifacts are automatically removed when container exits
- **Secure**: No host directories are exposed to containers
- **Automatic cleanup**: Container removal cleans up all build data

This approach follows the principle of least privilege - containers only have access to:

1. The Docker socket (required to build images)
2. Their own isolated filesystem (automatically managed by Docker)

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
- [x] Only Docker socket is mounted (required for builds)
- [x] Builds happen in isolated container filesystem
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
