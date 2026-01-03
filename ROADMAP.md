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

## 🏗️ Phase 2: Fundamental Features (Current)
- [ ] **Real-time Logs Stream**: Implement WebSocket or Server-Sent Events (SSE) to stream build logs from worker to dashboard.
- [ ] **GitHub Webhook Integration**: Automate deployments on `git push` instead of manual triggers.
- [ ] **Deployment History**: UI to view past deployments and their specific logs.
- [ ] **Environment Variable Management**: UI to add/edit secrets and env vars for services.
- [ ] **Health Checks**: Implement logic for the platform to monitor the health of deployed containers.

## 🚀 Phase 3: Reliability & UX Polish
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
1. **Live Build Logs**: The biggest missing piece for "Render-like" UX. We need to capture the Docker build stream and pipe it to the UI.
2. **GitHub Webhooks**: Connecting a repo is manual right now; webhooks make it feel like a real PaaS.
3. **Internal Port Detection**: Currently hardcoded to 3000; need a way to detect or configure the app's listening port.
