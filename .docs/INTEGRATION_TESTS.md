# Integration Tests

This document explains how to run integration tests for the Helvetia Cloud project.

## Overview

Integration tests verify that different parts of the application work together correctly. Unlike unit tests that use mocks, integration tests interact with real services like databases and message queues.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ and pnpm installed
- All dependencies installed (`pnpm install`)

## Test Types

### Unit Tests

Unit tests use mocks and don't require external services. They run by default:

```bash
pnpm test
```

### Integration Tests

Integration tests require real database and Redis instances. They are automatically skipped if `DATABASE_URL` is not set.

## Running Integration Tests

### 1. Start Test Containers

Start the test database and Redis using Docker Compose:

```bash
docker-compose -f docker-compose.test.yml up -d
```

This will start:

- PostgreSQL test database on port 5433
- Redis test instance on port 6380

### 2. Set Environment Variables

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/helvetia_test"
export REDIS_URL="redis://localhost:6380"
```

Or create a `.env.test` file:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/helvetia_test
REDIS_URL=redis://localhost:6380
```

### 3. Push Database Schema

```bash
pnpm --filter database db:push
```

### 4. Run Tests

Run all tests (including integration tests):

```bash
pnpm test
```

Run only integration tests:

```bash
pnpm --filter api test -- deployment.integration.test.ts
pnpm --filter api test -- webhook.integration.test.ts
pnpm --filter api test -- sse.integration.test.ts
```

### 5. Cleanup

Stop and remove test containers:

```bash
docker-compose -f docker-compose.test.yml down -v
```

## Integration Test Coverage

### API Integration Tests

#### Deployment Flow (`deployment.integration.test.ts`)

- Service deployment creation and queuing
- Different service types (DOCKER, STATIC, COMPOSE)
- Deployment status lifecycle
- Authorization and ownership checks
- GitHub token injection

#### Webhook Processing (`webhook.integration.test.ts`)

- GitHub webhook signature verification
- Pull request webhooks (opened, synchronize, closed)
- Push webhooks for automatic deployments
- Preview environment management
- Error handling and validation

#### SSE Streaming (`sse.integration.test.ts`)

- Server-Sent Events connection establishment
- Real-time metrics streaming
- Authentication and authorization
- Token expiration handling
- Connection cleanup
- CORS support

### Worker Integration Tests

Currently skipped in CI. See `worker.integration.test.ts` for build security tests.

## CI/CD Integration

Integration tests are currently skipped in CI because they require a database. Future improvements will add:

1. **Test Containers**: Use Testcontainers to automatically spin up Docker containers for tests
2. **CI Database**: Configure GitHub Actions to run PostgreSQL and Redis services
3. **Parallel Testing**: Run integration tests in parallel with unit tests

## Writing Integration Tests

### Best Practices

1. **Use Real Services**: Don't mock database or Redis calls
2. **Clean Up**: Always clean up test data in `afterAll` or `afterEach`
3. **Isolation**: Each test should be independent
4. **Skip Gracefully**: Use `describe.skip` when DATABASE_URL is not available

### Example

```typescript
import { prisma } from 'database';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from './server';

const shouldSkip = !process.env.DATABASE_URL;
const describeIf = shouldSkip ? describe.skip : describe;

describeIf('My Integration Test', () => {
  let app;
  let testUserId;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const user = await prisma.user.create({
      data: { email: 'test@example.com', ... }
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } });
    await app.close();
  });

  it('should do something', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/endpoint',
    });
    expect(response.statusCode).toBe(200);
  });
});
```

## Troubleshooting

### Tests Failing with Database Connection Error

Make sure:

1. Docker containers are running: `docker-compose -f docker-compose.test.yml ps`
2. DATABASE_URL is set correctly
3. Database schema is pushed: `pnpm --filter database db:push`

### Port Conflicts

If ports 5433 or 6380 are already in use, edit `docker-compose.test.yml` to use different ports.

### Slow Test Execution

Integration tests are slower than unit tests because they interact with real services. Consider:

- Running only specific test files during development
- Using test filters: `pnpm test -- <pattern>`
- Running integration tests less frequently than unit tests

## Future Improvements

- [ ] Add Testcontainers support for automatic container management
- [ ] Configure CI to run integration tests
- [ ] Add integration tests for worker deployment processing
- [ ] Add E2E tests for full deployment workflows
- [ ] Implement test data factories for easier test setup
