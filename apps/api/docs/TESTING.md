# Testing Guide

This document provides comprehensive guidance for writing and running tests in the Helvetia Cloud API service.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Unit Tests](#writing-unit-tests)
- [Mocking Patterns](#mocking-patterns)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)

## Overview

The API uses [Vitest](https://vitest.dev/) as the testing framework with the following features:

- **Fast execution**: Native ESM support and parallel test execution
- **TypeScript support**: Full TypeScript integration out of the box
- **Mocking utilities**: Built-in mocking via `vi` utilities
- **Coverage reporting**: V8 coverage provider for accurate code coverage

## Test Structure

Tests are located alongside the code they test using the `.test.ts` suffix:

```
apps/api/src/
├── services/
│   ├── BillingService.ts
│   ├── BillingService.test.ts     # Unit tests
│   ├── AuthenticationService.ts
│   └── AuthenticationService.test.ts
├── controllers/
│   ├── ServiceController.ts
│   └── ServiceController.test.ts
└── repositories/
    ├── PrismaUserRepository.ts
    └── PrismaUserRepository.test.ts
```

## Running Tests

### All Tests

```bash
# From repository root
pnpm --filter api test

# From apps/api directory
pnpm test
```

### Specific Test File

```bash
# Run a single test file
pnpm --filter api test BillingService.test.ts

# Run tests matching a pattern
pnpm --filter api test billing
```

### Watch Mode

```bash
# Run tests in watch mode (re-runs on file changes)
pnpm --filter api test:watch
```

### Coverage

```bash
# Generate coverage report
pnpm --filter api test:coverage

# Coverage reports are generated in:
# - apps/api/coverage/index.html (HTML report)
# - apps/api/coverage/lcov.info (LCOV format)
```

## Writing Unit Tests

### Basic Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'reflect-metadata'; // Required for dependency injection
import { YourService } from './YourService';

describe('YourService', () => {
  let service: YourService;
  let mockDependency: any;

  beforeEach(() => {
    // Setup fresh mocks for each test
    mockDependency = {
      someMethod: vi.fn(),
    };

    service = new YourService(mockDependency);
    vi.clearAllMocks();
  });

  describe('yourMethod', () => {
    it('should do something', async () => {
      // Arrange
      mockDependency.someMethod.mockResolvedValue('result');

      // Act
      const result = await service.yourMethod();

      // Assert
      expect(result).toBe('result');
      expect(mockDependency.someMethod).toHaveBeenCalledWith(expectedArgs);
    });

    it('should handle errors', async () => {
      // Arrange
      mockDependency.someMethod.mockRejectedValue(new Error('Test error'));

      // Act & Assert
      await expect(service.yourMethod()).rejects.toThrow('Test error');
    });
  });
});
```

### Testing with tsyringe Dependency Injection

Services using `@injectable()` and `@inject()` decorators:

```typescript
import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YourService } from './YourService';
import type { IDependency } from '../interfaces';

describe('YourService', () => {
  let service: YourService;
  let mockDependency: IDependency;

  beforeEach(() => {
    // Create mock implementing the interface
    mockDependency = {
      method1: vi.fn(),
      method2: vi.fn(),
    } as any;

    // Instantiate service with mocked dependencies
    service = new YourService(mockDependency);
    vi.clearAllMocks();
  });

  // ... tests
});
```

## Mocking Patterns

### Mocking Modules

```typescript
import { vi } from 'vitest';
import * as moduleName from './moduleName';

// Mock the entire module
vi.mock('./moduleName');

describe('YourTest', () => {
  beforeEach(() => {
    // Setup mock implementations
    vi.mocked(moduleName.someFunction).mockReturnValue('mocked value');
  });
});
```

### Mocking Prisma Client

```typescript
import { PrismaClient } from 'database';
import { vi } from 'vitest';

describe('YourService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      subscription: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      // Add other models as needed
    };
  });

  it('should query the database', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });

    const result = await service.getUser('user-1');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(result.email).toBe('test@example.com');
  });
});
```

### Mocking Stripe Client

Example from `BillingService.test.ts`:

```typescript
import Stripe from 'stripe';
import { vi } from 'vitest';
import * as stripeConfig from '../config/stripe';

// Mock the stripe configuration module
vi.mock('../config/stripe');

describe('BillingService', () => {
  let mockStripe: any;

  beforeEach(() => {
    // Create mock Stripe client
    mockStripe = {
      customers: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
      subscriptions: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: vi.fn(),
        },
      },
      invoices: {
        list: vi.fn(),
      },
      subscriptionItems: {
        createUsageRecord: vi.fn(),
      },
    };

    // Setup mocked functions
    vi.mocked(stripeConfig.getStripeClient).mockReturnValue(mockStripe);
    vi.mocked(stripeConfig.isStripeConfigured).mockReturnValue(true);
  });

  it('should create a customer', async () => {
    mockStripe.customers.create.mockResolvedValue({
      id: 'cus_test123',
      email: 'test@example.com',
    });

    const customerId = await billingService.getOrCreateCustomer({
      userId: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(customerId).toBe('cus_test123');
    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: 'test@example.com',
      name: 'Test User',
      metadata: {
        userId: 'user-1',
        organizationId: '',
      },
    });
  });

  it('should handle Stripe errors', async () => {
    const stripeError = new Stripe.errors.StripeError({
      type: 'api_error',
      message: 'API error',
    });

    mockStripe.customers.create.mockRejectedValue(stripeError);

    await expect(
      billingService.getOrCreateCustomer({
        userId: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      }),
    ).rejects.toThrow('API error');
  });
});
```

### Mocking External APIs

```typescript
import axios from 'axios';
import { vi } from 'vitest';

vi.mock('axios');

describe('ExternalAPIService', () => {
  it('should fetch data from external API', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { result: 'success' },
      status: 200,
    });

    const result = await service.fetchExternalData();

    expect(axios.get).toHaveBeenCalledWith('https://api.example.com/data');
    expect(result).toEqual({ result: 'success' });
  });

  it('should handle API errors', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

    await expect(service.fetchExternalData()).rejects.toThrow('Network error');
  });
});
```

## Test Coverage

### Coverage Requirements

Current coverage thresholds (defined in `vitest.config.ts`):

```typescript
coverage: {
  thresholds: {
    lines: 50,
    functions: 45,
    branches: 50,
    statements: 50,
  },
}
```

**Target coverage for new code: 80%+**

### Viewing Coverage Reports

After running `pnpm test:coverage`:

1. **HTML Report**: Open `apps/api/coverage/index.html` in a browser
2. **Terminal Output**: Coverage summary is printed after test run
3. **LCOV**: `apps/api/coverage/lcov.info` for CI/CD integration

### Improving Coverage

Focus on:

1. **Critical paths**: Payment processing, authentication, data persistence
2. **Error handling**: All error paths and edge cases
3. **Business logic**: Core service methods and calculations
4. **Status mapping**: Enum conversions and status transformations

Example from `BillingService` (97.95% coverage):

- ✅ All public methods tested
- ✅ Error scenarios covered
- ✅ Edge cases handled (null values, empty arrays, etc.)
- ✅ Stripe status mapping verified
- ✅ API error handling validated

## Best Practices

### 1. Test Structure (Arrange-Act-Assert)

```typescript
it('should calculate total', () => {
  // Arrange: Setup test data and mocks
  const items = [10, 20, 30];

  // Act: Execute the code under test
  const result = calculateTotal(items);

  // Assert: Verify the outcome
  expect(result).toBe(60);
});
```

### 2. Descriptive Test Names

```typescript
// ✅ Good: Describes what is tested and expected outcome
it('should throw error when Stripe is not configured', async () => {
  // ...
});

// ❌ Bad: Vague or unclear
it('test error', async () => {
  // ...
});
```

### 3. Test One Thing Per Test

```typescript
// ✅ Good: Each test validates one specific behavior
it('should create subscription successfully', async () => {
  // Test subscription creation only
});

it('should map Stripe status correctly', async () => {
  // Test status mapping only
});

// ❌ Bad: Testing multiple unrelated things
it('should create subscription and map status and handle errors', async () => {
  // Too many concerns in one test
});
```

### 4. Mock External Dependencies

```typescript
// ✅ Good: Mock external services
vi.mock('../config/stripe');

// ❌ Bad: Hitting real Stripe API
// Don't do actual API calls in unit tests
```

### 5. Test Error Scenarios

```typescript
describe('getUser', () => {
  it('should return user successfully', async () => {
    // Happy path test
  });

  it('should throw error when user not found', async () => {
    // Error scenario test
  });

  it('should handle database connection errors', async () => {
    // Infrastructure error test
  });
});
```

### 6. Use beforeEach for Setup

```typescript
describe('YourService', () => {
  let service: YourService;
  let mockDep: any;

  beforeEach(() => {
    // Fresh setup for each test
    mockDep = { method: vi.fn() };
    service = new YourService(mockDep);
    vi.clearAllMocks();
  });

  // Tests are now isolated
});
```

### 7. Test Edge Cases

```typescript
describe('calculateDiscount', () => {
  it('should calculate normal discount', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
  });

  it('should handle zero discount', () => {
    expect(calculateDiscount(100, 0)).toBe(100);
  });

  it('should handle 100% discount', () => {
    expect(calculateDiscount(100, 100)).toBe(0);
  });

  it('should handle negative amounts', () => {
    expect(() => calculateDiscount(-100, 10)).toThrow();
  });

  it('should handle invalid discount percentages', () => {
    expect(() => calculateDiscount(100, 150)).toThrow();
  });
});
```

### 8. Avoid Test Interdependence

```typescript
// ✅ Good: Each test is independent
describe('Counter', () => {
  beforeEach(() => {
    counter = new Counter();
  });

  it('should start at 0', () => {
    expect(counter.value).toBe(0);
  });

  it('should increment', () => {
    counter.increment();
    expect(counter.value).toBe(1);
  });
});

// ❌ Bad: Tests depend on execution order
describe('Counter', () => {
  const counter = new Counter(); // Shared state!

  it('should start at 0', () => {
    expect(counter.value).toBe(0);
  });

  it('should increment', () => {
    // Depends on previous test state
    counter.increment();
    expect(counter.value).toBe(1);
  });
});
```

### 9. Mock Time-Dependent Code

```typescript
it('should use current timestamp', async () => {
  // Mock Date.now()
  const mockTimestamp = 1640000000;
  vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp * 1000);

  const result = await service.reportUsage({
    subscriptionItemId: 'si_test',
    quantity: 100,
  });

  expect(mockStripe.subscriptionItems.createUsageRecord).toHaveBeenCalledWith(
    'si_test',
    expect.objectContaining({
      timestamp: mockTimestamp,
    }),
  );

  vi.restoreAllMocks();
});
```

### 10. Keep Tests Fast

- Mock external APIs and databases
- Avoid unnecessary async operations
- Use `beforeEach` for common setup
- Run tests in parallel (Vitest default)

## Common Patterns

### Testing Async Methods

```typescript
it('should handle async operations', async () => {
  mockService.fetchData.mockResolvedValue({ id: 1 });

  const result = await service.getData();

  expect(result.id).toBe(1);
});
```

### Testing Promise Rejections

```typescript
it('should handle rejected promises', async () => {
  mockService.fetchData.mockRejectedValue(new Error('Failed'));

  await expect(service.getData()).rejects.toThrow('Failed');
});
```

### Testing Type Guards

```typescript
it('should identify Stripe error correctly', () => {
  const stripeError = new Stripe.errors.StripeError({
    type: 'invalid_request_error',
    message: 'Invalid',
  });

  expect(stripeError).toBeInstanceOf(Stripe.errors.StripeError);
});
```

### Testing Array Operations

```typescript
it('should map all statuses', async () => {
  const statuses = ['active', 'trialing', 'past_due', 'canceled'];

  for (const status of statuses) {
    mockStripe.subscriptions.create.mockResolvedValue({
      status,
      // ...
    } as any);

    const result = await service.createSubscription({
      customerId: 'cus_test',
      priceId: 'price_test',
    });

    // Verify each status maps correctly
    expect(result.status).toBeDefined();
  }
});
```

## Troubleshooting

### Tests Not Running

```bash
# Clear Vitest cache
rm -rf apps/api/node_modules/.vitest

# Reinstall dependencies
pnpm install

# Regenerate Prisma client
pnpm generate
```

### Mock Not Working

```typescript
// Ensure mocks are set up before importing the module under test
vi.mock('../config/stripe');

import { BillingService } from './BillingService'; // Import after mock

// Also ensure vi.clearAllMocks() is called in beforeEach
```

### Coverage Not Updating

```bash
# Delete coverage directory and regenerate
rm -rf apps/api/coverage
pnpm --filter api test:coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Testing Best Practices](https://testingjavascript.com/)

## Examples

For complete examples, see:

- `apps/api/src/services/BillingService.test.ts` - Comprehensive Stripe mocking
- `apps/api/src/services/AuthenticationService.test.ts` - Authentication testing
- `apps/api/src/services/OrganizationService.test.ts` - Service layer testing
- `apps/api/src/repositories/PrismaUserRepository.test.ts` - Repository pattern testing
