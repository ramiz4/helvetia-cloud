# Helvetia Cloud MVP Architecture

## Overview

Helvetia Cloud is a minimal Platform-as-a-Service (PaaS) designed for automated deployments of web applications from GitHub.

## System Architecture

### 1. API Service (Node.js + Fastify)

- **Responsibility**: Management of users, services, and deployments.
- **Authentication**: GitHub OAuth.
- **Job Triggering**: Pushes jobs to Redis (BullMQ) for the Worker to process.
- **Data Store**: PostgreSQL (via Prisma).

### 2. Build Worker (Node.js)

- **Responsibility**: Consumes build jobs from Redis.
- **Process**:
  1. Clone repository.
  2. Build Docker image using the host Docker socket.
  3. Tag image.
  4. Notify API of build status.
- **Logging**: Captures `stdout`/`stderr` and stores them in the database.

### 3. Runtime Manager (API / Dedicated)

- **Responsibility**: Managing the lifecycle of service containers.
- **Deployment**: Starts containers with specific Traefik labels for dynamic routing.

### 4. Reverse Proxy (Traefik)

- **Responsibility**: Dynamic routing to containers.
- **Discovery**: Uses the Docker provider to detect labels on containers.
- **SSL**: Self-signed certificates for MVP.

### 5. Infrastructure

- **Message Queue**: Redis.
- **Database**: PostgreSQL.
- **Orchestration**: Docker Compose (for MVP local dev).

## Database Schema

### User

- `id` (UUID)
- `githubId` (String)
- `username` (String)
- `token` (String, encrypted)

### Service

- `id` (UUID)
- `userId` (FK)
- `name` (unique)
- `repoUrl` (String)
- `branch` (String)
- `buildCommand` (String)
- `startCommand` (String)
- `internalPort` (Int)
- `status` (Enum: IDLE, DEPLOYING, ACTIVE, FAILED)

### Deployment

- `id` (UUID)
- `serviceId` (FK)
- `status` (Enum: BUILDING, SUCCESS, FAILED)
- `logs` (Text)
- `commitHash` (String)
- `createdAt` (DateTime)

## Network Flow

1. Developer pushes to GitHub.
2. GitHub Webhook triggers API endpoint.
3. API creates a Deployment record and queues a job.
4. Worker picks up job, builds image.
5. Worker triggers Runtime Manager to start new container.
6. Traefik detects new container and routes `https://{name}.helvetia.cloud`.
