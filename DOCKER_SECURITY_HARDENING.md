# Docker Security Hardening Guide

## Table of Contents

1. [Overview](#overview)
2. [Docker Socket Security Risks](#docker-socket-security-risks)
3. [Mitigation Strategies](#mitigation-strategies)
4. [Docker Socket Proxy Implementation](#docker-socket-proxy-implementation)
5. [SELinux/AppArmor Policies](#selinuxapparmor-policies)
6. [Rootless Docker](#rootless-docker)
7. [Kubernetes Migration Path](#kubernetes-migration-path)
8. [Security Checklist](#security-checklist)

---

## Overview

Helvetia Cloud uses Docker to build and deploy containerized applications. This guide addresses the security implications of Docker socket access and provides hardening recommendations for production deployments.

## Docker Socket Security Risks

### The Problem

Direct access to the Docker socket (`/var/run/docker.sock`) provides **root-equivalent privileges** on the host system. Any container with socket access can:

- **Escape container isolation**: Mount the host filesystem and execute arbitrary code
- **Compromise the host**: Create privileged containers with full system access
- **Escalate privileges**: Run containers as root with capabilities
- **Access sensitive data**: Read files, environment variables, and secrets from other containers
- **Manipulate the Docker daemon**: Stop, remove, or modify any container on the system

### Current Implementation

Both the API and Worker services currently require Docker socket access to:

- **Worker**: Build Docker images and manage deployment containers
- **Traefik**: Discover containers and configure routing dynamically

### Risk Assessment

| Risk                 | Severity     | Impact                         |
| -------------------- | ------------ | ------------------------------ |
| Container Escape     | **Critical** | Full host system compromise    |
| Privilege Escalation | **High**     | Attacker gains root access     |
| Data Exposure        | **High**     | Access to all container data   |
| Service Disruption   | **High**     | Ability to stop all containers |

---

## Mitigation Strategies

### 1. Docker Socket Proxy (Implemented)

**Status**: ✅ Implemented

A Docker Socket Proxy acts as a security layer between services and the Docker daemon, restricting which Docker API endpoints can be accessed.

**Benefits**:

- Limits API access to only required operations
- Prevents privileged container creation
- Blocks host filesystem mounts
- Provides audit logging of Docker API calls

**Implementation**: See [Docker Socket Proxy Implementation](#docker-socket-proxy-implementation) section.

### 2. Rootless Docker

**Status**: 🔶 Recommended for advanced deployments

Running Docker in rootless mode eliminates root-level access even if the socket is compromised.

**Benefits**:

- Containers run as non-root user
- Limits blast radius of compromise
- Improved security isolation

**Limitations**:

- Some features unavailable (e.g., AppArmor, overlay networks)
- Slightly reduced performance
- Requires systemd or similar init system

**Implementation**: See [Rootless Docker](#rootless-docker) section.

### 3. SELinux/AppArmor Policies

**Status**: 🔶 Optional but recommended

Mandatory Access Control (MAC) systems provide an additional security layer.

**Benefits**:

- Restricts container capabilities at kernel level
- Prevents unauthorized system calls
- Limits file system access

**Implementation**: See [SELinux/AppArmor Policies](#selinuxapparmor-policies) section.

### 4. Kubernetes Migration

**Status**: 📋 Future consideration

For large-scale deployments, Kubernetes provides better security primitives.

**Benefits**:

- Built-in RBAC and network policies
- Pod Security Standards
- No Docker socket access required (uses CRI)
- Better multi-tenancy support

**Implementation**: See [Kubernetes Migration Path](#kubernetes-migration-path) section.

---

## Docker Socket Proxy Implementation

### Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Worker    │────────>│  Socket Proxy    │────────>│   Docker    │
│  Container  │  HTTP   │  (tecnativa)     │  Socket │   Daemon    │
└─────────────┘         └──────────────────┘         └─────────────┘
                         Filters & ACLs
```

### Implementation Details

The Docker Socket Proxy is configured in `docker-compose.yml`:

```yaml
docker-socket-proxy:
  image: tecnativa/docker-socket-proxy
  container_name: docker-socket-proxy
  restart: unless-stopped
  privileged: true # Required to access Docker socket
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro # Read-only mount
  environment:
    # Allow only required operations
    CONTAINERS: 1 # List, inspect containers
    POST: 1 # Create containers/exec
    BUILD: 1 # Build images
    COMMIT: 1 # Commit containers
    IMAGES: 1 # List, inspect images
    NETWORKS: 1 # Manage networks (required for Traefik)
    VOLUMES: 1 # Manage volumes (for data persistence)
    EXEC: 1 # Execute commands in containers

    # Deny dangerous operations
    ALLOW_START: 1 # Allow starting containers
    ALLOW_STOP: 1 # Allow stopping containers
    ALLOW_RESTARTS: 1 # Allow restart policy configuration
    SERVICES: 0 # Disable Docker Swarm services
    TASKS: 0 # Disable Docker Swarm tasks
    SWARM: 0 # Disable Swarm management
  networks:
    - helvetia-net
```

### Configuration Options

| Environment Variable | Default | Description                                |
| -------------------- | ------- | ------------------------------------------ |
| `CONTAINERS`         | 0       | Allow container operations (list, inspect) |
| `POST`               | 0       | Allow POST requests (create resources)     |
| `BUILD`              | 0       | Allow image builds                         |
| `COMMIT`             | 0       | Allow committing containers to images      |
| `IMAGES`             | 0       | Allow image operations                     |
| `NETWORKS`           | 0       | Allow network operations                   |
| `VOLUMES`            | 0       | Allow volume operations                    |
| `EXEC`               | 0       | Allow executing commands in containers     |
| `ALLOW_START`        | 0       | Allow starting containers                  |
| `ALLOW_STOP`         | 0       | Allow stopping containers                  |
| `ALLOW_RESTARTS`     | 0       | Allow restart policies                     |

**Security Note**: Set only the permissions required for your use case. The proxy blocks all operations by default.

### Connecting Services to Proxy

Services connect to the proxy using the Docker host environment variable:

```yaml
worker:
  environment:
    - DOCKER_HOST=tcp://docker-socket-proxy:2375
```

In code:

```typescript
import Docker from 'dockerode';

// Automatically uses DOCKER_HOST environment variable
const docker = new Docker();

// Or explicitly specify:
const docker = new Docker({
  host: 'docker-socket-proxy',
  port: 2375,
});
```

### Security Benefits

1. **API Filtering**: Only whitelisted Docker API endpoints are accessible
2. **Read-Only Socket Mount**: The proxy mounts the socket as read-only
3. **No Privileged Containers**: Services can't create privileged containers through the proxy
4. **Audit Trail**: All Docker API calls go through a single, monitored service
5. **Defense in Depth**: Additional security layer even if a service is compromised

### Limitations

- **Not a Complete Solution**: A compromised service can still create containers and potentially exploit Docker vulnerabilities
- **Requires Privileged Proxy**: The proxy itself needs privileged access to the socket
- **Performance Overhead**: Additional network hop for Docker API calls (minimal impact)

---

## SELinux/AppArmor Policies

### SELinux Configuration

SELinux (Security-Enhanced Linux) provides Mandatory Access Control (MAC) on RHEL, CentOS, and Fedora.

#### Enable SELinux for Docker

1. **Verify SELinux Status**:

   ```bash
   sestatus
   ```

2. **Set Docker Directory Context**:

   ```bash
   sudo semanage fcontext -a -t svirt_sandbox_file_t "/var/lib/docker(/.*)?"
   sudo restorecon -R /var/lib/docker
   ```

3. **Enable SELinux in Docker**:
   Edit `/etc/docker/daemon.json`:

   ```json
   {
     "selinux-enabled": true
   }
   ```

4. **Restart Docker**:
   ```bash
   sudo systemctl restart docker
   ```

#### SELinux Labels for Containers

Run containers with SELinux labels:

```yaml
services:
  worker:
    security_opt:
      - label=type:container_runtime_t
```

### AppArmor Configuration

AppArmor is used on Ubuntu and Debian systems.

#### Create AppArmor Profile

1. **Create Profile** (`/etc/apparmor.d/docker-helvetia`):

   ```
   #include <tunables/global>

   profile docker-helvetia flags=(attach_disconnected,mediate_deleted) {
     #include <abstractions/base>

     # Allow Docker operations
     /var/run/docker.sock rw,

     # Deny sensitive paths
     deny /root/** rwklx,
     deny /home/** rwklx,
     deny /etc/shadow r,
     deny /etc/passwd w,

     # Allow workspace directory
     /tmp/helvetia-workspaces/** rw,

     # Allow container operations
     capability net_admin,
     capability sys_admin,
   }
   ```

2. **Load Profile**:

   ```bash
   sudo apparmor_parser -r /etc/apparmor.d/docker-helvetia
   ```

3. **Apply to Container**:
   ```yaml
   services:
     worker:
       security_opt:
         - apparmor=docker-helvetia
   ```

### Seccomp Profiles

Seccomp restricts system calls available to containers.

#### Create Custom Seccomp Profile

Create `docker-seccomp.json`:

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64", "SCMP_ARCH_X86", "SCMP_ARCH_X32"],
  "syscalls": [
    {
      "names": [
        "accept",
        "accept4",
        "access",
        "bind",
        "chdir",
        "clone",
        "close",
        "connect",
        "dup",
        "dup2",
        "execve",
        "exit",
        "exit_group",
        "fchdir",
        "fcntl",
        "fork",
        "fstat",
        "getdents",
        "getpid",
        "listen",
        "mkdir",
        "open",
        "openat",
        "read",
        "readlink",
        "recvfrom",
        "recvmsg",
        "sendmsg",
        "sendto",
        "socket",
        "stat",
        "write",
        "writev"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

Apply in Docker Compose:

```yaml
services:
  worker:
    security_opt:
      - seccomp=./docker-seccomp.json
```

---

## Rootless Docker

### Overview

Rootless Docker runs the Docker daemon and containers as a non-root user, significantly reducing the security impact of a compromise.

### Prerequisites

- **systemd** (for user session management)
- **uidmap** package installed
- **Kernel version** 5.11+ recommended (for better performance)
- **User namespace** support enabled in kernel

### Installation

1. **Install Rootless Docker**:

   ```bash
   curl -fsSL https://get.docker.com/rootless | sh
   ```

2. **Set Environment Variables** (add to `~/.bashrc`):

   ```bash
   export PATH=/home/$USER/bin:$PATH
   export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock
   ```

3. **Enable Service**:

   ```bash
   systemctl --user enable docker
   systemctl --user start docker
   ```

4. **Set Linger** (allows service to run when user is not logged in):
   ```bash
   sudo loginctl enable-linger $(whoami)
   ```

### Limitations

- **No AppArmor/SELinux**: MAC systems don't work in rootless mode
- **No Overlay Networks**: Only host and bridge networks supported
- **Port Binding**: Ports < 1024 require `sysctl` configuration:
  ```bash
  sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80
  ```
- **Performance**: Slightly slower due to additional user namespace layer

### Migrating Helvetia Cloud to Rootless

1. **Install rootless Docker** on the host
2. **Update `.env`** to point to rootless socket:
   ```bash
   DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock
   ```
3. **Update docker-compose.yml** to use rootless socket:
   ```yaml
   worker:
     volumes:
       - /run/user/${UID}/docker.sock:/var/run/docker.sock
   ```
4. **Test thoroughly**: Some features may require adjustments

### When to Use Rootless Docker

✅ **Use Rootless Docker If**:

- Running on a single-user development machine
- Security is paramount and you can accept limitations
- You don't need AppArmor/SELinux integration

❌ **Don't Use Rootless Docker If**:

- You need AppArmor/SELinux (prefer socket proxy instead)
- You require overlay networks
- Performance is critical (use socket proxy + seccomp instead)

---

## Kubernetes Migration Path

### Why Migrate to Kubernetes?

Kubernetes provides better security primitives for multi-tenant PaaS platforms:

- **No Docker Socket Required**: Uses Container Runtime Interface (CRI)
- **RBAC**: Fine-grained access control for API operations
- **Network Policies**: Container-level firewall rules
- **Pod Security Standards**: Enforced security configurations
- **Secret Management**: Built-in secret encryption and rotation
- **Resource Quotas**: Prevent resource exhaustion attacks

### Migration Strategy

#### Phase 1: Local Development with Kind/Minikube

1. **Install Kubernetes** (for testing):

   ```bash
   # Kind (Kubernetes in Docker)
   curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
   chmod +x ./kind
   sudo mv ./kind /usr/local/bin/kind

   # Create cluster
   kind create cluster --name helvetia-dev
   ```

2. **Create Namespaces**:

   ```yaml
   # namespaces.yaml
   apiVersion: v1
   kind: Namespace
   metadata:
     name: helvetia-system # Control plane
   ---
   apiVersion: v1
   kind: Namespace
   metadata:
     name: helvetia-services # User deployments
   ```

3. **Deploy Control Plane**:
   - API server as a Deployment
   - Worker as a Deployment (with build permissions)
   - PostgreSQL as a StatefulSet
   - Redis as a StatefulSet

#### Phase 2: Build System

Replace Docker-in-Docker builds with one of:

**Option A: Kaniko** (Recommended)

- Builds images without Docker daemon
- Runs as unprivileged container
- No security risks

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: kaniko-build
spec:
  containers:
    - name: kaniko
      image: gcr.io/kaniko-project/executor:latest
      args:
        - '--context=git://github.com/user/repo'
        - '--destination=registry.example.com/image:tag'
      volumeMounts:
        - name: docker-config
          mountPath: /kaniko/.docker/
```

**Option B: Buildah**

- Daemonless container builds
- Compatible with Dockerfiles
- Rootless by default

**Option C: BuildKit**

- Modern Docker build backend
- No daemon required (standalone mode)
- Better caching and performance

#### Phase 3: Dynamic Container Creation

Replace direct Docker API calls with Kubernetes API:

```typescript
import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

// Create deployment
await k8sApi.createNamespacedDeployment('helvetia-services', {
  metadata: { name: serviceName },
  spec: {
    replicas: 1,
    selector: { matchLabels: { app: serviceName } },
    template: {
      metadata: { labels: { app: serviceName } },
      spec: {
        containers: [
          {
            name: serviceName,
            image: imageTag,
            env: envVars,
            resources: {
              limits: { memory: '512Mi', cpu: '1000m' },
              requests: { memory: '256Mi', cpu: '500m' },
            },
          },
        ],
      },
    },
  },
});
```

#### Phase 4: Ingress and Routing

Replace Traefik with Kubernetes Ingress:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: user-services
  annotations:
    cert-manager.io/cluster-issuer: 'letsencrypt-prod'
spec:
  rules:
    - host: '*.helvetia.cloud'
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: dynamic-service
                port:
                  number: 80
```

#### Phase 5: Security Policies

```yaml
# Pod Security Policy (or Pod Security Standards)
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: helvetia-restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

### Timeline and Effort

| Phase                          | Effort          | Dependencies |
| ------------------------------ | --------------- | ------------ |
| **Phase 1**: Local K8s setup   | 1-2 weeks       | None         |
| **Phase 2**: Build system      | 2-3 weeks       | Phase 1      |
| **Phase 3**: API migration     | 3-4 weeks       | Phase 2      |
| **Phase 4**: Ingress setup     | 1-2 weeks       | Phase 3      |
| **Phase 5**: Security policies | 1 week          | Phase 4      |
| **Testing & Hardening**        | 2-3 weeks       | All phases   |
| **Total**                      | **10-15 weeks** | -            |

### Cost-Benefit Analysis

#### Benefits

- ✅ Eliminates Docker socket security risks
- ✅ Better multi-tenancy isolation
- ✅ Scales to large deployments
- ✅ Industry-standard platform
- ✅ Built-in RBAC and security policies
- ✅ Better resource management

#### Costs

- ❌ Significant development effort (10-15 weeks)
- ❌ Increased operational complexity
- ❌ Requires Kubernetes expertise
- ❌ Higher infrastructure costs (control plane overhead)
- ❌ Learning curve for team

### Recommendation

**For Current Scale**: Use Docker Socket Proxy + SELinux/AppArmor

- Adequate security for small-medium deployments
- Much less complexity than Kubernetes
- Can be implemented in days, not months

**For Future Scale**: Migrate to Kubernetes

- When supporting 100+ concurrent users
- When multi-tenancy becomes critical
- When security compliance requires stronger isolation
- When team has Kubernetes expertise

---

## Security Checklist

### Immediate (Docker Socket Proxy)

- [x] Deploy Docker Socket Proxy in docker-compose.yml
- [x] Configure minimal required permissions
- [x] Update Worker to use proxy instead of direct socket
- [x] Update Traefik to use proxy
- [x] Test deployment workflow
- [x] Document proxy configuration

### Short-Term (1-2 weeks)

- [ ] Implement SELinux or AppArmor profiles
- [ ] Add Seccomp profiles for containers
- [ ] Enable audit logging for Docker API calls
- [ ] Implement container resource limits
- [ ] Add monitoring for security events
- [ ] Document security hardening steps

### Medium-Term (1-3 months)

- [ ] Evaluate rootless Docker for non-production environments
- [ ] Implement automated security scanning (Trivy, Clair)
- [ ] Add runtime security monitoring (Falco)
- [ ] Create incident response plan
- [ ] Conduct security audit
- [ ] Train team on Docker security best practices

### Long-Term (6+ months)

- [ ] Evaluate Kubernetes migration
- [ ] Prototype build system with Kaniko/BuildKit
- [ ] Design Kubernetes architecture
- [ ] Plan migration strategy
- [ ] Allocate resources for migration
- [ ] Document Kubernetes operational procedures

---

## Additional Resources

### Documentation

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)

### Tools

- [Docker Socket Proxy](https://github.com/Tecnativa/docker-socket-proxy)
- [Trivy](https://github.com/aquasecurity/trivy) - Container vulnerability scanner
- [Falco](https://falco.org/) - Runtime security monitoring
- [Kaniko](https://github.com/GoogleContainerTools/kaniko) - Container builder
- [BuildKit](https://github.com/moby/buildkit) - Modern Docker build backend

### Community

- [Docker Security Forum](https://forums.docker.com/c/security/18)
- [Kubernetes Security SIG](https://github.com/kubernetes/community/tree/master/sig-security)
- [Cloud Native Security Whitepaper](https://www.cncf.io/blog/2020/11/18/announcing-the-cloud-native-security-white-paper/)

---

## Conclusion

Docker socket access is a significant security risk, but it can be mitigated through a defense-in-depth approach:

1. **Now**: Deploy Docker Socket Proxy with minimal permissions
2. **Soon**: Add SELinux/AppArmor and Seccomp profiles
3. **Later**: Consider Kubernetes migration for stronger isolation

The implemented Docker Socket Proxy provides immediate security improvements while maintaining compatibility with existing workflows. For production deployments, additional hardening with MAC systems is strongly recommended.
