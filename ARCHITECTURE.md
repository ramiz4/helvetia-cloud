# 🏗️ Helvetia Cloud MVP Architecture

## 🌐 Overview

Helvetia Cloud is a production-realistic Platform-as-a-Service (PaaS) architected for high-performance automated deployments. It leverages a modern, distributed system design to handle source control integration, containerized builds, and dynamic traffic routing.

## 🏗️ System Components

### 1. API Engine (Node.js + Fastify)

- **Core Orchestrator**: Manages the lifecycle of users, services, and deployments.
- **Security**: Implements JWT-based authentication and secure session management.
- **Rate Limiting**: Production-grade rate limiting with Redis-backed distributed storage to prevent abuse and DoS attacks across multiple API instances.
  - Global rate limits (100 req/min by default)
  - Stricter limits for authentication endpoints (10 req/min)
  - Connection limits for WebSocket log streaming (10 conn/min)
  - Health check endpoints excluded for monitoring
  - IP-based tracking with configurable limits via environment variables
- **Source Integration**: Handles GitHub OAuth and processes Webhook events for automated CI/CD.
- **Job Dispatcher**: Queues heavy tasks (builds/deployments) to Redis via BullMQ.

### 2. Build Worker (Node.js + Dockerode)

- **Isolation**: Performs builds in temporary **Docker-in-Docker (DinD)** containers to ensure host safety and environment consistency.
- **Optimization**: Implements Docker layer caching to accelerate subsequent builds.
- **Process**:
  1. Clones the target repository and branch.
  2. Generates optimized Dockerfiles for both **Docker** and **Static** service types.
  3. Executes `docker build` with specified resource limits.
  4. Tags and pushes images to the local registry.
- **Redaction**: Automatically scrubs sensitive environment variables from build logs.

### 3. Runtime Manager

- **Lifecycle Management**: Starts, stops, and restarts service containers.
- **Hardening**: Enforces CPU and Memory limits at the container level.
- **Health Monitoring**: Configures Traefik health checks to enable **Zero-Downtime Deployments**.

### 4. Dynamic Proxy (Traefik)

- **Discovery**: Automatically detects new services via Docker socket labels.
- **Routing**: Routes traffic to `https://{service-name}.helvetia.cloud`.
- **Custom Domains**: Supports user-defined domains via label injection.

### 5. Infrastructure

- **Persistence**: PostgreSQL (via Prisma ORM).
- **Messaging**: Redis (BullMQ) for reliable background processing.
- **Orchestration**: Docker Compose for local development; architected for future Kubernetes migration.

## 📊 Data Models

### User

- `id`: Unique identifier.
- `githubId`: Link to GitHub account.
- `accessToken`: Securely stored token for repository access.

### Service

- `type`: `DOCKER` or `STATIC`.
- `status`: `IDLE`, `DEPLOYING`, `ACTIVE`, `FAILED`, `STOPPED`.
- `config`: Environment variables, resource limits, and custom domains.

### Deployment

- `commitHash`: The Git commit SHA triggered by the build.
- `logs`: Real-time captured stdout/stderr.
- `duration`: Time taken for the build process.

## 🔄 Deployment Flow

1. **Trigger**: Developer pushes to a tracked branch (GitHub Webhook) or manually triggers from the Dashboard.
2. **Queue**: API creates a `Deployment` record and pushes a job to Redis.
3. **Build**: Worker picks up the job, builds the image in an isolated environment, and redacts secrets from the log stream.
4. **Deploy**: Runtime Manager starts the new container with health checks enabled.
5. **Rollover**: Traefik waits for the new container to pass health checks before routing traffic and decommissioning the old instance (Zero-Downtime).
6. **Observability**: Live logs and performance metrics are streamed back to the Dashboard via SSE/WebSockets.
