# CI Database Setup

## Overview

This document describes the database infrastructure configuration for running tests in the CI environment.

## Problem

Tests require PostgreSQL and Redis infrastructure to run properly. The test suites in `apps/api` and `apps/worker` are configured to connect to:

- **PostgreSQL**: `localhost:5433`
- **Redis**: `localhost:6380`

These non-standard ports are used to avoid conflicts with local development databases.

## Solution

The CI workflow (`.github/workflows/ci.yml`) uses GitHub Actions services to provide PostgreSQL and Redis containers with the correct port mappings.

### PostgreSQL Configuration

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: helvetia_test
    ports:
      - 5433:5432  # Maps host port 5433 to container port 5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

**Environment Variable**: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/helvetia_test`

### Redis Configuration

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - 6380:6379  # Maps host port 6380 to container port 6379
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

**Environment Variable**: `REDIS_URL=redis://localhost:6380`

## Local Testing

To run tests locally with the same configuration, use Docker Compose:

```bash
# Start test databases
docker-compose -f docker-compose.test.yml up -d

# Run tests
pnpm test

# Stop test databases
docker-compose -f docker-compose.test.yml down
```

The `docker-compose.test.yml` file provides the same PostgreSQL and Redis configuration as the CI environment.

## Test Configuration Files

Test configurations that reference these databases:

1. **apps/api/vitest.config.ts**
   - Default DATABASE_URL: `postgresql://postgres:postgres@localhost:5433/helvetia_test`
   - Default REDIS_URL: `redis://localhost:6380`

2. **apps/worker/vitest.config.ts**
   - Default DATABASE_URL: `postgresql://postgres:postgres@localhost:5433/helvetia_test`
   - Default REDIS_URL: `redis://localhost:6380`

3. **.env.test.example**
   - Template for local test environment variables

## Benefits

1. **No Port Conflicts**: Test databases use different ports than development databases
2. **Isolated Testing**: Each test run gets a clean database environment
3. **Consistent Configuration**: Same ports and credentials used locally and in CI
4. **Health Checks**: Ensures databases are ready before tests run
5. **Fast Startup**: Alpine-based Redis image for quick container startup

## Troubleshooting

### Tests Fail with Connection Errors

- Ensure PostgreSQL is running on port 5433
- Ensure Redis is running on port 6380
- Check that DATABASE_URL and REDIS_URL environment variables are set correctly
- Verify containers are healthy: `docker ps`

### Port Already in Use

If ports 5433 or 6380 are already in use:

1. Stop any existing test databases: `docker-compose -f docker-compose.test.yml down`
2. Check for other processes: `lsof -i :5433` or `lsof -i :6380`
3. Kill conflicting processes or change the ports in both `docker-compose.test.yml` and `vitest.config.ts` files

### Database Migration Errors

Ensure migrations are applied before running tests:

```bash
pnpm generate       # Generate Prisma Client
pnpm migrate:deploy # Apply migrations
pnpm test          # Run tests
```

The CI workflow automatically runs these steps in order.
