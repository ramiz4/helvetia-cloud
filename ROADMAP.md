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

## ✅ Phase 5: UI/UX & Developer Experience

- [x] **Landing Page**: A modern, engaging landing page that highlights the platform's key features and benefits.
- [x] **Main Menu**: A global menu bar that provides quick access to key features and actions.
- [x] **Dashboard Redesign**: Adopt a premium, glassmorphic aesthetic with improved information architecture and navigation.
- [x] **Interactive Logs**: Advanced log viewer with search, filtering, and live-tailing capabilities.
- [x] **Mobile Responsiveness**: Full mobile support for monitoring and management on the go.
- [x] **Dark/Light Mode**: System-aware theming support.
- [x] **GitHub Repository Picker**: Allow users to select repositories and branches directly from their GitHub account when creating a service. Ensure the "Connect a Repository" form features a premium, fancy, and user-friendly UX/UI for a seamless experience.
- [x] **Static Site Service**: Dedicated support for deploying static applications (Angular, React, Vue) using optimized multi-stage Docker builds and Nginx for high performance.

## 🔮 Phase 6: Advanced Ecosystem & Growth

- [ ] **Database-as-a-Service**: One-click provisioning of managed databases (Postgres, Redis, MySQL).
- [ ] **Preview Environments**: Automatic ephemeral deployments for Pull Requests.
- [ ] **Team Collaboration**: Organizations, member management, and RBAC (Role-Based Access Control).
- [ ] **Billing Integration**: Stripe integration for implementation of usage-based pricing and subscription tiers.
- [ ] **Marketplace**: One-click catalog for deploying popular open-source applications (e.g., WordPress, Ghost, Plausible).
- [ ] **CLI Tool**: specialized command-line tool for Helvetia Cloud.

## 🛠 Code Quality & Technical Debt

- [x] **Documentation Maintenance**: Review and update all project documentation (README.md, ARCHITECTURE.md, and all other .md files) to ensure they are accurate and up-to-date with the current implementation.
- [x] **CI/CD Pipeline**: Add a GitHub Action workflow following best practices to automate linting, testing, and security scanning for the application.
- [ ] **Comprehensive Testing**: Add robust unit, integration, and E2E tests across all services (API, Worker, Dashboard) to achieve high code coverage.
- [ ] **Environment Configuration**: Extract hardcoded `http://localhost:3001` in `src/app/page.tsx` to an environment variable.
- [ ] **React State Management**: Fix `useEffect` dependency issue in `src/app/page.tsx` (potential infinite loop with `services` dependency).
- [ ] **UI/UX**: Restore multi-line formatting for delete confirmation message in `src/app/page.tsx`.
- [ ] **Styling**: Refactor inline styles to Tailwind CSS classes in `src/components/LandingPage.tsx`.
- [ ] **Modal Accessibility**: Implement proper focus trapping and Escape key handling for modals in `src/app/page.tsx`.
- [ ] **Logo Accessibility**: Add `alt` text or ARIA attributes to the logo in `src/components/Navigation.tsx`.
- [ ] **Hydration**: Remove `suppressHydrationWarning` from `src/app/layout.tsx` and fix the underlying hydration mismatches.
- [ ] **Input Accessibility**: Add ARIA labels to the search input in `src/app/page.tsx`.
- [ ] **Dependency Cleanup**: Remove unused `tailwind-merge` dependency in `package.json` if not needed.
- [ ] **Code Cleanup**: Remove unused `Settings` import in `src/components/Navigation.tsx`.
- [ ] **Token Security**: The GitHub token is stored in localStorage without encryption or additional security measures. localStorage is vulnerable to XSS attacks and the token persists across sessions. Implement more secure storage mechanisms like HTTP-only cookies for sensitive tokens, or implement token expiration and refresh mechanisms.
- [x] **CODEOWNERS**: Add a CODEOWNERS file to define repository ownership and streamline the PR review process.

## 🔭 Future Horizon

- **Multi-Region & Cluster Mode**: Kubernetes-based orchestration for high availability.
- **Serverless Functions**: Support for deploying standalone serverless functions.
- **Edge Networking**: Global CDN integration and edge routing.
