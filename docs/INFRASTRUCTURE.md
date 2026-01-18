# Infrastructure & Deployment Implementation

## Overview

Helvetia Cloud is designed to be a robust, containerized platform. This document outlines the infrastructure setup, deployment strategies, and security hardening measures.

---

## 1. Deployment Architecture

The platform consists of several dockerized services working in orchestration:

| Service          | Function                      | Key Config                                              |
| :--------------- | :---------------------------- | :------------------------------------------------------ |
| **Traefik**      | Reverse Proxy & Load Balancer | Ports 80/443, Auto-TLS (Let's Encrypt)                  |
| **API**          | Backend Logic & Orchestration | Node.js/Fastify, connects to Docker Socket Proxy        |
| **Worker**       | Background Jobs & Deployment  | Connects to Docker Socket for container management      |
| **Dashboard**    | Frontend UI                   | Next.js Standalone Mode                                 |
| **Postgres**     | Primary Database              | Version 16, Persistent Volume                           |
| **Redis**        | Queues & Caching              | Version 7, Alpine based                                 |
| **Socket Proxy** | Docker Security               | Filters Docker API calls (read-only + specific control) |

### Docker Compose

We use `docker-compose.prod.yml` for production deployments. It defines:

- Networks (`traefik-public`, `internal`).
- Volume persistence (`postgres_data`, `redis_data`, `letsencrypt`).
- Restart policies (`unless-stopped`).
- Health checks for all critical services.

### Verification

- **Dashboard**: `https://yourdomain.com`
- **API**: `https://api.yourdomain.com/health`
- **Monitoring**: `https://monitor.yourdomain.com` (Grafana)

---

## 2. CI/CD & Database Setup

### GitHub Actions

We use GitHub Actions for Continuous Integration.

- **Lint & Test**: Runs on every PR. Validates code style and runs unit tests.
- **Build**: Ensures all packages and apps build successfully.

### Database in CI

To support integration tests in CI, we configure service containers:

- **Postgres**: Ephemeral instance for tests.
- **Redis**: Ephemeral instance for queues.

_Note: Integration tests utilizing the database are skipped if `DATABASE_URL` is not present._

---

## 3. Configuration & Environment Parsing

Correct configuration is critical for infrastructure stability. We use a custom parser (`packages/shared/src/utils/config.ts`) to ensure safety.

### Features

- **Type Safety**: Parsers for `String`, `Integer` (with min/max), and `Float`.
- **Validation**:
  - _NaN Check_: Falls back to default if parsing fails.
  - _Range Check_: Clamps values to min/max (e.g., Memory Limit between 64MB and 8GB).
- **Logging**: Warns on invalid or clamped values during startup.

### Key Configuration Variables

- `CONTAINER_MEMORY_LIMIT_MB`: Default 512MB.
- `CONTAINER_CPU_CORES`: Default 1.0.
- `STATUS_LOCK_TTL_MS`: For distributed locking (default 10s).
- `IMAGE_RETENTION_DAYS`: Webhook cleanup policy (default 7 days).

---

## 4. Security Hardening

### Docker Security

We implement strict security measures for the Docker socket interaction:

- **Socket Proxy**: The API/Worker **never** accesses the raw Docker socket (`/var/run/docker.sock`). Instead, they connect to a proxy container (`tecnativa/docker-socket-proxy`).
- **Permissions**: The proxy is configured to allow only necessary endpoints (e.g., `POST /containers/*/start`, `GET /containers/json`) and blocks privileged actions.

### Container Security

- **Non-Root Users**: Application containers run as non-root users where possible.
- **ReadOnly Filesystems**: Critical system paths are mounted read-only.
- **Network Isolation**: Backend services (Postgres, Redis) remain on the `internal` network, inaccessible from the public internet.
