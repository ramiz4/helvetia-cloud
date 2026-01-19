# Testing Strategy

This project uses a clear separation between **unit tests** and **integration tests** following industry best practices.

## Test Types

### Unit Tests (`*.test.ts`)

- **Fast**: Run in milliseconds
- **Isolated**: Mock all external dependencies (database, Redis, Docker, etc.)
- **Purpose**: Test business logic in isolation
- **Run by default**: `pnpm test`

### Integration Tests (`*.integration.test.ts`)

- **Slower**: May take seconds per test
- **Real dependencies**: Use actual database, may use real services
- **Purpose**: Test end-to-end workflows and API contracts
- **Run explicitly**: `pnpm test:integration`

## Commands

```bash
# Run only unit tests (fast, default)
pnpm test

# Watch mode for unit tests
pnpm test:watch

# Run only integration tests
pnpm test:integration

# Watch mode for integration tests
pnpm test:integration:watch

# Run all tests (unit + integration)
pnpm test:all

# Run tests with coverage
pnpm test:coverage
```

## File Naming Convention

- **Unit tests**: `ComponentName.test.ts`
- **Integration tests**: `ComponentName.integration.test.ts`

## Configuration

- **Unit tests**: `vitest.config.ts` (excludes `*.integration.test.ts`)
- **Integration tests**: `vitest.integration.config.ts` (includes only `*.integration.test.ts`)

## CI/CD Recommendations

```yaml
# Example GitHub Actions workflow
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
      redis:
        image: redis:7
    steps:
      - run: pnpm test:integration
```

## Best Practices

1. **Write unit tests first** - They're faster and catch most bugs
2. **Use integration tests for critical paths** - Authentication, payments, data integrity
3. **Keep integration tests focused** - Test one workflow per test
4. **Clean up after integration tests** - Use `beforeAll`/`afterAll` hooks
5. **Use descriptive test names** - Describe the behavior being tested
