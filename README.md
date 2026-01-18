# 🌫️ Helvetia Cloud

A premium, production-realistic **Platform-as-a-Service (PaaS)** designed for seamless, automated deployments from GitHub. Experience a sleek, glassmorphic dashboard while Helvetia handles the heavy lifting of containerization, routing, and scaling.

---

## 📚 Documentation

- **[API Documentation](./apps/api/docs/README.md)** - Complete API reference and guides
- **[API Getting Started](./apps/api/docs/API_GETTING_STARTED.md)** - Quick start guide with code examples
- **[Interactive API Docs](http://localhost:3001/api/v1/docs)** - Swagger UI (development)
- **[Architecture](./docs/ARCHITECTURE.md)** - System architecture and design decisions
- **[Security](./apps/api/docs/SECURITY.md)** - Security guidelines and best practices

---

## ✨ Key Features

- **🚀 Automated Deployments**: Fully integrated with GitHub webhooks for instant `git push` deployments.
- **🎨 Premium UI/UX**: A modern, glassmorphic dashboard featuring real-time logs and deployment history.
- **📦 Multi-Service Support**: Native support for **Docker-based** backends and optimized **Static Sites** (React, Vue, Angular).
- **🛡️ Secure & Isolated**: Builds are performed in isolated Docker-in-Docker environments with resource limits (CPU/Memory) and secret scrubbing.
- **🚦 Dynamic Routing**: Traefik-powered routing with support for custom domains and automatic health checks.
- **📊 Comprehensive Observability**: Full PLG stack (Prometheus, Loki, Grafana) with automated dashboard provisioning and log aggregation.
- **🏗️ Developer First**: Smart GitHub repository picker and branch selection for a seamless onboarding experience.

## 🛠 Tech Stack

- **Dashboard**: [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/)
- **Admin Panel**: [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/) (Standalone)
- **API Engine**: [Fastify](https://www.fastify.io/), [Prisma](https://www.prisma.io/), [JWT Auth](https://jwt.io/)
- **Workforce**: [BullMQ](https://docs.bullmq.io/) (Redis), [Dockerode](https://github.com/apocas/dockerode)
- **Networking**: [Traefik](https://traefik.io/), [Docker Compose](https://docs.docker.com/compose/)
- **Storage**: [PostgreSQL](https://www.postgresql.org/), [Redis](https://redis.io/)

## 📦 Monorepo Structure

```
helvetia-cloud/
├── apps/
│   ├── dashboard/    # Main user dashboard (port 3000)
│   ├── admin/        # Admin control panel (port 3002)
│   ├── api/          # REST API service (port 3001)
│   └── worker/       # Background job processor
└── packages/
    ├── database/     # Shared Prisma client
    ├── shared/       # Shared backend utilities (Docker, Redis)
    └── shared-ui/    # Shared frontend utilities & UI components
```

The platform consists of three main frontend applications:

- **Dashboard** (`apps/dashboard`): Main user interface for managing projects and deployments
- **Admin Panel** (`apps/admin`): Standalone administrative control panel for platform management
- **API** (`apps/api`): Backend REST API service
- **Worker** (`apps/worker`): Background job processor for deployments

### Shared Packages

- **`packages/shared`**: Backend utilities for API and Worker (Docker orchestration, Redis, distributed locks)
- **`packages/shared-ui`**: Frontend utilities for Dashboard and Admin (React components, i18n, auth, types)
- **`packages/database`**: Prisma client used by all services

---

## 🚀 Getting Started

### 1. Prerequisites

- **Docker** & **Docker Compose**
- **Node.js 20+** & **pnpm**

### 2. Rapid Setup

```bash
# 1. Clone & Setup Env
cp .env.example .env

# 2. Start Infrastructure (Postgres, Redis, Traefik)
docker-compose up -d postgres redis docker-socket-proxy traefik

# 3. Install & Run
pnpm install
pnpm migrate:dev
pnpm dev
```

### 3. Critical Configuration

Update `.env` with these essentials:

- **GitHub OAuth**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (for auth and deployments)
- **Secrets**: `JWT_SECRET`, `ENCRYPTION_KEY` (32-char), `GITHUB_WEBHOOK_SECRET`
- **Domain**: `PLATFORM_DOMAIN` (default: `localhost`)

_See `.env.example` for all available configuration options including Rate Limiting and Resource Limits._

### 4. Services Access

| Service       | URL                                     | Description               |
| ------------- | --------------------------------------- | ------------------------- |
| **Dashboard** | [localhost:3000](http://localhost:3000) | Main UI (Port 3000)       |
| **API**       | [localhost:3001](http://localhost:3001) | REST API (Port 3001)      |
| **Admin**     | [localhost:3002](http://localhost:3002) | Admin Panel (Port 3002)   |
| **Traefik**   | [localhost:8090](http://localhost:8090) | Router Dashboard          |
| **Grafana**   | [localhost:3010](http://localhost:3010) | Metrics (`admin`/`admin`) |

### Production & Deployment

- **Local Production Build**: Run `pnpm build && pnpm start` to test the optimized build.
- **Deploy to VPS**: Read our [Deployment Guide](./docs/DEPLOYMENT.md) for DigitalOcean/AWS setup.

---

## 🧪 Testing

Helvetia Cloud includes comprehensive unit and integration tests to ensure reliability and maintainability.

### Running Tests

**Unit Tests** (uses mocks, no external dependencies):

```bash
pnpm test
```

**With Coverage**:

```bash
pnpm test:coverage
```

**Integration Tests** (requires database and Redis):

1. Start test containers:

```bash
docker-compose -f docker-compose.test.yml up -d
```

2. Set test environment variables:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/helvetia_test"
export REDIS_URL="redis://localhost:6380"
```

3. Push database schema:

```bash
pnpm migrate:dev
```

4. Run tests:

```bash
pnpm test
```

5. Cleanup:
1. Start test containers:

   ```bash
   docker-compose -f docker-compose.test.yml up -d
   ```

1. Set test environment variables:

   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/helvetia_test"
   export REDIS_URL="redis://localhost:6380"
   ```

1. Push database schema:

   ```bash
   pnpm migrate:dev
   ```

1. Run tests:

   ```bash
   pnpm test
   ```

1. Cleanup:

   ```bash
   docker-compose -f docker-compose.test.yml down -v
   ```

**Test Coverage**: The project maintains a minimum 80% code coverage threshold across all packages.

### Billing Tests

Comprehensive test infrastructure is available for billing-related features:

- **Mock Stripe Client**: In-memory Stripe API implementation for testing
- **Test Fixtures**: Predefined billing scenarios and test data
- **47 Test Cases**: Coverage for BillingService, SubscriptionService, and UsageTrackingService
- **Documentation**: Complete guide for writing billing tests

For detailed information about billing tests, see [apps/api/docs/BILLING_TESTS.md](./apps/api/docs/BILLING_TESTS.md).

For detailed information about integration tests, see [docs/INTEGRATION_TESTS.md](./docs/INTEGRATION_TESTS.md).

---

## 🗺 Roadmap

Stay updated with our progress and future plans in the [docs/ROADMAP.md](./docs/ROADMAP.md).

## 🏗 Architecture

For a deep dive into how Helvetia Cloud works, check out [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## 📊 Monitoring

Helvetia Cloud includes a full observability stack (PLG) for real-time monitoring of metrics and logs.

### Prometheus Metrics

Both API and Worker services expose Prometheus metrics that are automatically scraped:

- **API Metrics**: `http://localhost:3001/metrics`
- **Worker Metrics**: `http://localhost:3002/metrics`

### Grafana Dashboards

A pre-configured Grafana dashboard is available at [http://localhost:3010](http://localhost:3010). It provides real-time visualization of deployment success rates, request latency, and container resource usage.

**Key Assets:**

- [Complete Metrics Documentation](./apps/api/docs/METRICS.md)
- [Grafana Dashboard Definition](./grafana-dashboard.json)

**Example Prometheus Configuration:**

```yaml
scrape_configs:
  - job_name: 'helvetia-api'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'

  - job_name: 'helvetia-worker'
    static_configs:
      - targets: ['localhost:3002']
    metrics_path: '/metrics'
```

### Health Check Endpoints

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

- [Worker Health Check Format](./apps/worker/docs/HEALTH_CHECK.md)
- [Monitoring Setup Guide](./apps/worker/docs/MONITORING_SETUP.md)

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
