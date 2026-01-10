# 🌫️ Helvetia Cloud

A premium, production-realistic **Platform-as-a-Service (PaaS)** designed for seamless, automated deployments from GitHub. Experience a sleek, glassmorphic dashboard while Helvetia handles the heavy lifting of containerization, routing, and scaling.

---

## ✨ Key Features

- **🚀 Automated Deployments**: Fully integrated with GitHub webhooks for instant `git push` deployments.
- **🎨 Premium UI/UX**: A modern, glassmorphic dashboard featuring real-time logs and deployment history.
- **📦 Multi-Service Support**: Native support for **Docker-based** backends and optimized **Static Sites** (React, Vue, Angular).
- **🛡️ Secure & Isolated**: Builds are performed in isolated Docker-in-Docker environments with resource limits (CPU/Memory) and secret scrubbing.
- **🚦 Dynamic Routing**: Traefik-powered routing with support for custom domains and automatic health checks.
- **📊 Real-time Monitoring**: Live log streaming (SSE/WebSockets) and container resource usage metrics.
- **🏗️ Developer First**: Smart GitHub repository picker and branch selection for a seamless onboarding experience.

## 🛠 Tech Stack

- **Dashboard**: [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/)
- **API Engine**: [Fastify](https://www.fastify.io/), [Prisma](https://www.prisma.io/), [JWT Auth](https://jwt.io/)
- **Workforce**: [BullMQ](https://docs.bullmq.io/) (Redis), [Dockerode](https://github.com/apocas/dockerode)
- **Networking**: [Traefik](https://traefik.io/), [Docker Compose](https://docs.docker.com/compose/)
- **Storage**: [PostgreSQL](https://www.postgresql.org/), [Redis](https://redis.io/)

---

## 🚀 Getting Started

### 1. Prerequisites

- Docker & Docker Compose
- Node.js (v20+) & [pnpm](https://pnpm.io/)

### 2. Setup Environment

Clone the repository and copy the example environment variables:

```bash
cp .env.example .env
```

#### Required Configuration

**GitHub OAuth** (Required):

- `GITHUB_CLIENT_ID`: Your GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET`: Your GitHub OAuth App Client Secret

**Core Services** (Required):

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret key for JWT token signing
- `ENCRYPTION_KEY`: A 32-character key for encrypting sensitive data (e.g. GitHub tokens)
- `ENCRYPTION_SALT`: A random hex string used as a salt for encryption key derivation
- `PLATFORM_DOMAIN`: Your platform's domain (e.g., `helvetia.cloud`)
- `APP_BASE_URL`: The base URL of the application, used for CORS configuration (e.g., `http://localhost:3000`)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS (e.g., `http://localhost:3000,https://app.example.com`). Falls back to `APP_BASE_URL` if not set.
- `NODE_ENV`: The environment mode (e.g., `development` or `production`)

  **Dashboard Configuration** (Next.js):

- `NEXT_PUBLIC_API_URL`: The URL of the API Service (e.g., `http://localhost:3001`)
- `NEXT_PUBLIC_WS_URL`: The WebSocket URL for real-time logs (e.g., `ws://localhost:3001`)
- `NEXT_PUBLIC_APP_URL`: The URL of the Dashboard itself (e.g., `http://localhost:3000`)

#### Rate Limiting Configuration (Optional)

The API includes production-ready rate limiting with Redis-backed distributed storage. Configure these values to adjust rate limits based on your deployment needs:

**Global Rate Limiting**:

- `RATE_LIMIT_MAX`: Maximum requests per time window (default: `100`)
- `RATE_LIMIT_WINDOW`: Time window for rate limiting (default: `1 minute`)

**Authentication Endpoint** (stricter to prevent brute force):

- `AUTH_RATE_LIMIT_MAX`: Maximum auth requests per time window (default: `10`)
- `AUTH_RATE_LIMIT_WINDOW`: Time window for auth rate limiting (default: `1 minute`)

**WebSocket Log Streaming** (prevents connection abuse):

- `WS_RATE_LIMIT_MAX`: Maximum WebSocket connections per time window (default: `10`)
- `WS_RATE_LIMIT_WINDOW`: Time window for WebSocket rate limiting (default: `1 minute`)

> **Note**: Health check endpoints (`/health`) are automatically excluded from rate limiting for monitoring purposes.

#### Container & Resource Configuration (Optional)

Configure resource limits and operational parameters for deployed containers:

**Container Resource Limits**:

- `CONTAINER_MEMORY_LIMIT_MB`: Memory limit per container in MB (default: `512`)
- `CONTAINER_CPU_CORES`: CPU cores per container (default: `1.0`)

**Service Configuration**:

- `MAX_LOG_SIZE_CHARS`: Maximum log size stored in database (default: `50000`)
- `METRICS_UPDATE_INTERVAL_MS`: Interval for metrics updates in milliseconds (default: `5000` = 5 seconds)
- `STATUS_RECONCILIATION_INTERVAL_MS`: Interval for status reconciliation in milliseconds (default: `30000` = 30 seconds)
- `CONNECTION_TIMEOUT_MS`: SSE connection timeout in milliseconds (default: `1800000` = 30 minutes)
- `WORKER_HEALTH_PORT`: Worker health check server port (default: `3002`)

**Distributed Lock Configuration**:

- `STATUS_LOCK_TTL_MS`: Default lock TTL for status updates in milliseconds (default: `10000` = 10 seconds)
- `STATUS_RECONCILIATION_LOCK_TTL_MS`: Lock TTL for status reconciliation in milliseconds (default: `5000` = 5 seconds)
- `LOCK_RETRY_DELAY_MS`: Retry delay between lock acquisition attempts in milliseconds (default: `200`)
- `LOCK_RETRY_JITTER_MS`: Random jitter added to retry delay in milliseconds (default: `100`)

**Body Size Limits**:

- `BODY_LIMIT_GLOBAL_MB`: Global body size limit in MB (default: `10`)
- `BODY_LIMIT_STANDARD_MB`: Standard body size limit in MB (default: `1`)
- `BODY_LIMIT_SMALL_KB`: Small body size limit in KB (default: `100`)

> **Note**: All default values are production-ready. Only adjust these if you have specific deployment requirements.

#### GitHub Webhook Configuration

To enable automated deployments via GitHub webhooks:

1. **Generate a webhook secret** (or use any strong random string):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Add to your `.env` file**:

   ```env
   GITHUB_WEBHOOK_SECRET=your_generated_secret_here
   ```

3. **Configure in GitHub Repository**:
   - Go to your repository settings
   - Navigate to **Settings** > **Webhooks** > **Add webhook**
   - Set **Payload URL** to: `https://your-domain.com/webhooks/github`
   - Set **Content type** to: `application/json`
   - Set **Secret** to: The same value as your `GITHUB_WEBHOOK_SECRET`
   - Select events: **Push events** and **Pull requests**
   - Click **Add webhook**

> **Security Note**: The webhook endpoint verifies GitHub signatures using HMAC SHA-256. Requests without valid signatures are rejected with a 401 status code. Always keep your webhook secret secure and never commit it to version control.

### 3. Launch Infrastructure

Start the core services (Database, Redis, Docker Socket Proxy, and Traefik):

```bash
docker-compose up -d postgres redis docker-socket-proxy traefik
```

> **Security Note**: The Docker Socket Proxy provides a security layer between services and the Docker daemon, restricting API access with ACLs. See [DOCKER_SECURITY_HARDENING.md](./DOCKER_SECURITY_HARDENING.md) for details.

### 4. Initialize & Start

Install dependencies, prepare the database, and run in development mode:

```bash
pnpm install
pnpm db:push
pnpm dev
```

### 5. Access the Platform

- **Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Engine**: [http://localhost:3001](http://localhost:3001)
- **Worker Health Check**: [http://localhost:3002/health](http://localhost:3002/health)
- **Traefik Dashboard**: [http://localhost:8090](http://localhost:8090)

### 6. Running in Production Mode

To run the optimized, built version of the application:

1.  **Build the application**:

    ```bash
    pnpm build
    ```

2.  **Start the production server**:
    ```bash
    pnpm start
    ```
    This will start all services (`api`, `worker`, `dashboard`) using their built artifacts in `dist/` folders. It ensures better performance and mimics a real production environment.

---

## 🗺 Roadmap

Stay updated with our progress and future plans in the [ROADMAP.md](./ROADMAP.md).

## 🏗 Architecture

For a deep dive into how Helvetia Cloud works, check out [ARCHITECTURE.md](./ARCHITECTURE.md).

## 📊 Monitoring

Helvetia Cloud includes built-in health check endpoints for monitoring service health and performance.

### Worker Health Check

The worker service exposes an HTTP health check endpoint at `/health` (default port: 3002) that provides:

- Overall service health status
- Queue statistics (waiting, active, completed, failed jobs)
- Redis connection status
- Worker uptime information

**Quick Check:**

```bash
curl http://localhost:3002/health
```

**Documentation:**

- [Worker Health Check Format](./apps/worker/HEALTH_CHECK.md)
- [Monitoring Setup Guide](./apps/worker/MONITORING_SETUP.md)

**Integrations:**

- Docker health checks
- Kubernetes liveness/readiness probes
- Prometheus metrics
- Uptime monitoring services (UptimeRobot, Pingdom, etc.)

## 🔍 Code Review & Issues

A comprehensive code review has been completed, resulting in **32 prioritized findings** across security, reliability, and code quality.

- **✅ Actionable Issues**: All findings have been converted into [GitHub Issues](https://github.com/ramiz4/helvetia-cloud/issues) with labels (`P0`, `P1`, etc.).
- **🔄 Automated Sync**: Issues are managed via `scripts/sync-github-issues.js`, which keeps the repository in sync with the `github_issues.json` source of truth.
- **📊 Priorities**:
  - **P0**: Critical Security (Must Fix)
  - **P1**: High Priority (Reliability/Bugs)
  - **P2**: Medium Priority (Improvements)
  - **P3**: Low Priority (Polish)

---

## 📄 License

This project is open-source and available under the MIT License.
