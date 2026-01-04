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

## ✅ Phase 3: Reliability & UX Polish

- [x] **Zero-Downtime Deploys**: Use Traefik's health checks to ensure the new container is ready before stopping the old one.
- [x] **Container Metrics**: Basic CPU/Memory usage stats on the dashboard.
- [x] **GitHub OAuth Integration**: Complete the login flow (currently mocked).
- [x] **Build Optimization**: Implement layer caching to speed up Docker builds.
- [x] **Custom Domains**: Allow users to point their own domains to the services.

## ✅ Phase 4: Security & Hardening

- [x] **Resource Limits**: Enforce CPU/Memory limits on user containers.
- [x] **Isolated Build Environments**: Use temporary Docker-in-Docker containers for builds to prevent host pollution.
- [x] **API Authentication**: Secure all API endpoints with JWT. (Partially done in Phase 3)
- [x] **Sensitive Data Scrubbing**: Ensure secrets are redacted from build/runtime logs.

---

## 🚧 Phase 5: UI/UX & Developer Experience

- [ ] **Dashboard Redesign**: Adopt a premium, glassmorphic aesthetic with improved information architecture and navigation.
- [ ] **Interactive Logs**: Advanced log viewer with search, filtering, and live-tailing capabilities.
- [ ] **Command Palette**: Global `Cmd+K` interface for quick navigation and actions.
- [ ] **Onboarding Flow**: Interactive guide for new users deploying their first service.
- [ ] **Mobile Responsiveness**: Full mobile support for monitoring and management on the go.
- [ ] **Dark/Light Mode**: System-aware theming support.

## 🔮 Phase 6: Advanced Ecosystem & Growth

- [ ] **Database-as-a-Service**: One-click provisioning of managed databases (Postgres, Redis, MySQL).
- [ ] **Preview Environments**: Automatic ephemeral deployments for Pull Requests.
- [ ] **Team Collaboration**: Organizations, member management, and RBAC (Role-Based Access Control).
- [ ] **Billing Integration**: Stripe integration for implementation of usage-based pricing and subscription tiers.
- [ ] **Marketplace**: One-click catalog for deploying popular open-source applications (e.g., WordPress, Ghost, Plausible).
- [ ] **CLI Tool**: specialized command-line tool for Helvetia Cloud.

## 🔭 Future Horizon

- **Multi-Region & Cluster Mode**: Kubernetes-based orchestration for high availability.
- **Serverless Functions**: Support for deploying standalone serverless functions.
- **Edge Networking**: Global CDN integration and edge routing.
