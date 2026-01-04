# Helvetia Cloud Roadmap

This roadmap tracks the progress of the Helvetia Cloud MVP.

## ✅ Phase 1: Core Infrastructure & Foundation
- [x] High-level Architecture Design
- [x] Initial Project Structure (Monorepo with pnpm)
- [x] Docker Compose Setup (Postgres, Redis, Traefik)
- [x] Database Schema Definition (Prisma)
- [x] API Service Skeleton (Fastify)
- [x] Worker Service Skeleton (BullMQ)
- [x] Dashboard Skeleton (Next.js)

## ✅ Phase 2: Fundamental Features
- [x] **Real-time Logs Stream**: Implement WebSocket or Server-Sent Events (SSE) to stream build logs from worker to dashboard.
- [x] **GitHub Webhook Integration**: Automate deployments on `git push` instead of manual triggers.
- [x] **Deployment History**: UI to view past deployments and their specific logs.
- [x] **Environment Variable Management**: UI to add/edit secrets and env vars for services.
- [x] **Health Checks**: Implement logic for the platform to monitor the health of deployed containers.

## 🏗️ Phase 3: Reliability & UX Polish (Current)
- [ ] **Zero-Downtime Deploys**: Use Traefik's health checks to ensure the new container is ready before stopping the old one.
- [ ] **Container Metrics**: Basic CPU/Memory usage stats on the dashboard.
- [ ] **GitHub OAuth Integration**: Complete the login flow (currently mocked).
- [ ] **Build Optimization**: Implement layer caching to speed up Docker builds.
- [ ] **Custom Domains**: Allow users to point their own domains to the services.

## 🛡️ Phase 4: Security & Hardening
- [ ] **Resource Limits**: Enforce CPU/Memory limits on user containers.
- [ ] **Isolated Build Environments**: Use temporary Docker-in-Docker containers for builds to prevent host pollution.
- [ ] **API Authentication**: Secure all API endpoints with JWT.
- [ ] **Sensitive Data Scrubbing**: Ensure secrets are redacted from build/runtime logs.

---

## 📋 Next Priorities
1. **Zero-Downtime Deploys**: Making sure the app doesn't go down during updates.
2. **Container Metrics**: Visualizing resource usage.
3. **GitHub OAuth**: Full login flow with user's real repos.
