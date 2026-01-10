# Test Coverage Report

This document provides an overview of the current test coverage status and improvement plan for the Helvetia Cloud project.

## Current Coverage Status

### API Package

- **Statements**: 52.93%
- **Branches**: 52.61%
- **Functions**: 48.64%
- **Lines**: 53.95%
- **Threshold**: 50% (Progressive target: 80%)

**Key Coverage Areas:**

- ✅ Utils (crypto, statusLock, repoUrl): 83.5%
- ✅ Config: 100%
- ✅ Schemas: 100%
- ⚠️ server.ts: 46.97% (main application logic)

### Worker Package

- **Statements**: 42.61%
- **Branches**: 46.02%
- **Functions**: 44.28%
- **Lines**: 42.34%
- **Threshold**: 40% (Progressive target: 80%)

**Key Coverage Areas:**

- ✅ Utils (generators, logs, workspace): 61.73%
- ✅ cleanup.ts: 80.95%
- ✅ health-server.ts: 57.14%
- ✅ Config: 100%
- ⚠️ worker.ts: 2.24% (main deployment logic - requires Docker)

### Dashboard Package

- **Statements**: 63.52%
- **Branches**: 48.3%
- **Functions**: 63.96%
- **Lines**: 64.3%
- **Threshold**: 60% (Progressive target: 80%)

**Key Coverage Areas:**

- ✅ Utils: 100%
- ✅ SearchBar: 100%
- ✅ StatsCards: 100%
- ✅ ErrorBoundary: 90%
- ✅ Hooks (useServices): 62.33%
- ⚠️ LanguageSwitcher: 42.18%
- ⚠️ UserMenu: 60%

## Test Suite Composition

### Unit Tests

- **API**: 178 passing tests
- **Worker**: 86 passing tests
- **Dashboard**: 36 passing tests
- **Total**: 300 unit tests

### Integration Tests (Skipped without DATABASE_URL)

- **Deployment Flow**: 10 tests
- **Webhook Processing**: 16 tests
- **SSE Streaming**: 14 tests
- **Total**: 40 integration tests

### Total Test Count

- **342 tests** (300 passing + 42 skipped by default)

## Coverage Analysis

### Well-Tested Areas

1. **Utility Functions**: 83-100% coverage
   - Cryptography (encryption/decryption)
   - Repository URL parsing
   - Service name validation
   - Log scrubbing
   - Dockerfile validation
   - YAML generation

2. **Configuration**: 100% coverage
   - Environment variable parsing
   - Constants validation

3. **Error Handling Components**: 90% coverage
   - ErrorBoundary component
   - Error logging

### Areas Needing Improvement

#### API Package - server.ts (46.97% coverage)

**Issue**: Main application file contains 2000+ lines of code with endpoint logic mixed with business logic.

**Improvement Plan**:

1. Extract business logic into separate service files
2. Test services independently with unit tests
3. Use integration tests for endpoint-to-endpoint flows
4. Consider refactoring large functions into smaller, testable units

**Uncovered Critical Paths**:

- OAuth callback handling (lines 734-823)
- Service metrics collection (lines 1248-1433)
- Deployment status reconciliation
- Container restart logic
- Service deletion workflow

#### Worker Package - worker.ts (2.24% coverage)

**Issue**: Main deployment worker requires Docker for proper testing.

**Why Low Coverage**:

- Docker-in-Docker operations are difficult to mock
- Build processes require real filesystem and Docker daemon
- Integration with BullMQ requires Redis

**Improvement Options**:

1. **Testcontainers**: Use testcontainers library to spin up Docker for tests
2. **Mocking**: Create comprehensive mocks for Dockerode and filesystem operations
3. **Separate Logic**: Extract business logic from Docker operations
4. **E2E Tests**: Add end-to-end tests that run in Docker environment

**Current Testing**:

- ✅ Dockerfile validation: 65.73%
- ✅ YAML generation: 100%
- ✅ Workspace management: 100%
- ✅ Log scrubbing: 100%
- ⚠️ Actual deployment: 2.24%

#### Dashboard Package - UI Components (48-70% coverage)

**Issue**: Interactive UI components have many code paths for user interactions.

**Uncovered Areas**:

- User menu interactions
- Language switcher state management
- GitHub repository picker pagination
- Navigation menu mobile behavior

**Improvement Plan**:

1. Add more user interaction tests with @testing-library/user-event
2. Test component state changes
3. Test error states and edge cases
4. Add visual regression tests

## Integration Test Strategy

### Current State

Integration tests are comprehensive but require external services:

- PostgreSQL database
- Redis instance
- Proper environment variables

Tests are **automatically skipped** when `DATABASE_URL` is not set, ensuring CI/CD doesn't fail.

### Running Integration Tests Locally

```bash
# 1. Start test containers
docker-compose -f docker-compose.test.yml up -d

# 2. Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/helvetia_test"
export REDIS_URL="redis://localhost:6380"

# 3. Run tests
pnpm test

# 4. Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Future CI Integration

To enable integration tests in CI:

1. Add PostgreSQL and Redis services to GitHub Actions workflow
2. Set DATABASE_URL and REDIS_URL in workflow environment
3. Run database migrations before tests
4. Integration tests will automatically run

Example GitHub Actions configuration:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: helvetia_test
    ports:
      - 5432:5432

  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
```

## Roadmap to 80% Coverage

### Phase 1: Low-Hanging Fruit (Target: +5-10%)

1. Add tests for dashboard components with low coverage
2. Improve webhook processing tests
3. Test error handling paths
4. Test edge cases in existing functions

**Estimated Effort**: 1-2 days
**Expected Coverage Increase**: 55% → 60-65%

### Phase 2: Service Layer Extraction (Target: +10-15%)

1. Extract business logic from server.ts into service files
2. Test services independently
3. Keep server.ts as thin routing layer
4. Add service integration tests

**Estimated Effort**: 3-5 days
**Expected Coverage Increase**: 60-65% → 70-75%

### Phase 3: Worker Testing Infrastructure (Target: +5-10%)

1. Set up testcontainers for Docker operations
2. Create mock strategies for complex Docker operations
3. Add worker process unit tests
4. Add deployment flow integration tests

**Estimated Effort**: 3-4 days
**Expected Coverage Increase**: 70-75% → 75-80%

### Phase 4: E2E Tests (Target: +5%)

1. Set up Playwright or Cypress
2. Test critical user flows end-to-end
3. Test deployment lifecycle
4. Test real-time features (SSE, logs)

**Estimated Effort**: 2-3 days
**Expected Coverage Increase**: 75-80% → 80-85%

## Conclusion

**Current Achievement**:

- ✅ 342 comprehensive tests (300 passing, 42 integration)
- ✅ Coverage reporting infrastructure complete
- ✅ CI/CD integration ready
- ✅ Test containers setup complete
- ✅ Documentation complete

**Progressive Coverage Targets**:

- 🎯 **Phase 1** (Current): 50-60% baseline
- 🎯 **Phase 2**: 65% - Extract services, improve API tests
- 🎯 **Phase 3**: 75% - Worker testing infrastructure
- 🎯 **Phase 4**: 80% - Full integration and E2E tests

**Next Steps**:

1. Enable integration tests in CI by adding database services
2. Extract business logic from server.ts for better testability
3. Implement testcontainers for worker testing
4. Continue iterative coverage improvements

The project has a solid testing foundation with room for systematic improvement toward the 80% coverage goal.
