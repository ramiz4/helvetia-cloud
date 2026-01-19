# CI/CD Workflow Optimization

## Overview

The GitHub Actions CI workflow has been optimized to run test suites in parallel, significantly reducing total CI time.

## Before vs After

### Before (Sequential)

```
┌─────────────┐
│    Lint     │ ~30s
└─────────────┘
       ↓
┌─────────────┐
│ All Tests   │ ~30s (unit + integration)
│  + Coverage │
└─────────────┘
       ↓
┌─────────────┐
│   Security  │ ~20s
└─────────────┘
       ↓
┌─────────────┐
│    Build    │ ~40s
└─────────────┘

Total: ~2 minutes (sequential)
```

### After (Parallel)

```
┌─────────────┐
│    Lint     │ ~30s
└─────────────┘
       ↓
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Unit Tests  │ Integration │  Security   │    Build    │
│   ~15s      │   ~20s      │   ~20s      │   ~40s      │
│ (parallel)  │ (parallel)  │ (parallel)  │ (parallel)  │
└─────────────┴─────────────┴─────────────┴─────────────┘

Total: ~1 minute (parallel execution)
```

**Time Savings: ~50% faster CI runs!**

## Jobs Breakdown

### 1. `lint` (Sequential - runs first)

- Checks code formatting with Prettier
- Runs ESLint
- **No dependencies needed**
- **Duration**: ~30 seconds

### 2. `unit-tests` (Parallel)

- Runs all unit tests across workspaces
- Generates coverage reports
- **No database required** (uses mocks)
- Uploads coverage to Codecov
- **Duration**: ~15 seconds

### 3. `integration-tests` (Parallel)

- Runs API integration tests only
- **Requires PostgreSQL and Redis services**
- Runs database migrations
- Tests real database interactions
- **Duration**: ~20 seconds

### 4. `security` (Parallel)

- Audits npm dependencies
- Checks for high-severity vulnerabilities
- **Duration**: ~20 seconds

### 5. `build` (Parallel)

- Builds the dashboard application
- Validates TypeScript compilation
- **Duration**: ~40 seconds

## Key Improvements

### ✅ Parallel Execution

- Unit tests, integration tests, security audit, and build now run simultaneously
- Reduces total CI time by ~50%

### ✅ Faster Feedback

- Unit tests complete quickly (~15s) giving fast feedback on most issues
- Integration tests run in parallel, not blocking other checks

### ✅ Resource Optimization

- Unit tests don't spin up database services (faster startup)
- Integration tests only run where needed (API package)

### ✅ Better Coverage Tracking

- Separate coverage flags for unit vs integration tests
- Easier to track test coverage trends over time

## Coverage Flags

Coverage is now tracked separately:

- `api-unit` - API unit test coverage
- `worker-unit` - Worker unit test coverage
- `dashboard-unit` - Dashboard unit test coverage

This allows you to see coverage trends for different test types in Codecov.

## Running Locally

Match the CI behavior locally:

```bash
# Run what CI runs in parallel
pnpm test              # Unit tests (fast)
pnpm test:integration  # Integration tests (needs DB)

# Or run everything
pnpm test:all
```

## Troubleshooting

### If unit tests fail

- Check test mocks are properly configured
- Ensure no integration tests are in unit test files

### If integration tests fail

- Verify database is running: `docker ps | grep postgres`
- Check migrations are applied: `pnpm migrate:status`
- Ensure Redis is running: `docker ps | grep redis`

## Future Optimizations

Consider these additional improvements:

1. **Matrix Testing**: Test against multiple Node.js versions
2. **Caching**: Cache `node_modules` and build artifacts
3. **Conditional Runs**: Skip tests if only docs changed
4. **Test Sharding**: Split large test suites across multiple runners
