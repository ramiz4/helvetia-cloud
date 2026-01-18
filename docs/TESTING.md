# Testing & Quality Assurance

## Overview

Helvetia Cloud maintains a high standard of code quality through a rigorous testing strategy comprising Unit Tests, Integration Tests, and Code Coverage analysis.

---

## 1. Unit Tests

Unit tests are the first line of defense. They isolate individual functions and components, mocking external dependencies.

- **Frontend (`apps/dashboard`)**: Uses Vitest + React Testing Library. Tests components, hooks, and utilities.
- **Backend (`apps/api`, `apps/worker`)**: Uses Vitest. Tests services, controllers, and utility logic.
- **Shared (`packages/*`)**: Tests shared utilities and config parsers.

**Command**: `pnpm test`

---

## 2. Integration Tests

Integration tests verify that different parts of the application work together correctly, interacting with real (containerized) services like Postgres and Redis.

### Setup

Integration tests require a running database and Redis instance. We use Docker Compose for this environment.

```bash
# 1. Start Test Infrastructure
docker-compose -f docker-compose.test.yml up -d

# 2. Set Test Environment
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/helvetia_test"
export REDIS_URL="redis://localhost:6380"

# 3. Run Tests
pnpm test
```

### Key Scenarios

- **Deployment Flow**: Verifies the end-to-end process of queuing a deployment, simple status updates, and limit checks.
- **Webhooks**: Tests the processing of GitHub webhooks (Push, PR) and Stripe webhooks.
- **SSE Streaming**: Verifies the real-time event stream connectivity.

_Note: These tests are currently skipped in CI if the `DATABASE_URL` is not present._

---

## 3. Code Coverage

We track code coverage to ensure critical paths are tested.

### Current Status (Approximate)

| Package       | Statements | Status | Key Areas                                                                     |
| :------------ | :--------- | :----- | :---------------------------------------------------------------------------- |
| **API**       | ~53%       | ⚠️     | Good coverage on Utils/Config. Needs improvement in `server.ts` (main logic). |
| **Worker**    | ~43%       | ⚠️     | Docker logic is hard to mock. Needs Testcontainers implementation.            |
| **Dashboard** | ~64%       | ✅     | Strong coverage on components and hooks.                                      |

### Improvement Plan

1.  **Phase 1**: Improve API service layer coverage by extracting logic from controllers.
2.  **Phase 2**: Implement `Testcontainers` for the Worker to safely test Docker operations.
3.  **Phase 3**: Add E2E tests (Playwright) for critical user flows.

### Goal

The progressive target is **80% coverage** across all packages.
