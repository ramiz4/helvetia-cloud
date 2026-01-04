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

_Ensure you configure your `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` for GitHub OAuth._

### 3. Launch Infrastructure

Start the core services (Database, Redis, and Traefik):

```bash
docker-compose up -d postgres redis traefik
```

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
- **Traefik Dashboard**: [http://localhost:8080](http://localhost:8080)

---

## 🗺 Roadmap

Stay updated with our progress and future plans in the [ROADMAP.md](./ROADMAP.md).

## 🏗 Architecture

For a deep dive into how Helvetia Cloud works, check out [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 📄 License

This project is open-source and available under the MIT License.
