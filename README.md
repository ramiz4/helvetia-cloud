# Helvetia Cloud

A minimal, production-realistic Platform-as-a-Service (PaaS) for automated deployments of web applications from GitHub.

## Features

- **Automated Builds**: Clones and builds Docker images from Git repos.
- **Dynamic Routing**: Uses Traefik to route traffic to containers via `https://{service}.helvetia.cloud`.
- **Infrastructure**: Powered by BullMQ (Redis) for job processing and PostgreSQL for data.
- **Dashboard**: Premium, dark-mode management interface.

## Tech Stack

- **Backend**: Node.js, Fastify, Prisma, BullMQ.
- **Worker**: Node.js, Dockerode, Docker-out-of-Docker.
- **Frontend**: Next.js, Vanilla CSS.
- **Infra**: PostgreSQL, Redis, Traefik.

## Prerequisites

- Docker & Docker Compose
- Node.js & pnpm

## Getting Started

### 1. Setup Environment

Copy the example environment variables:

```bash
cp .env.example .env
```

_(Optionally configure GitHub OAuth and domain)_

### 2. Start Infrastructure

```bash
docker-compose up -d postgres redis traefik
```

### 3. Initialize Database

```bash
pnpm install
pnpm db:push
```

### 4. Run Services locally

```bash
pnpm dev
```

Accessible at:

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3001
- **Traefik Dashboard**: http://localhost:8080

## Deployment Workflow

1. Click **New Service** on the dashboard.
2. Enter the GitHub repository URL and branch.
3. Helvetia worker clones the repo, builds a container, and starts it.
4. Traefik automatically routes traffic to the new container.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed breakdown.
