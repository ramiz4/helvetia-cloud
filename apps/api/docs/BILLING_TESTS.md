# Billing Tests Documentation

This document provides comprehensive information about testing billing-related functionality in Helvetia Cloud.

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Writing Billing Tests](#writing-billing-tests)
- [Test Fixtures](#test-fixtures)
- [Mock Stripe Client](#mock-stripe-client)
- [Integration Tests](#integration-tests)
- [Best Practices](#best-practices)

## Overview

The billing system integrates with Stripe for subscription management and usage-based billing. Our test infrastructure provides:

- **Mock Stripe client** - In-memory implementation of Stripe API
- **Test fixtures** - Predefined billing scenarios and test data
- **Database setup** - Configuration for integration tests
- **Example tests** - Sample tests demonstrating patterns

## Test Infrastructure

### Mock Stripe Client

Location: `apps/api/src/test/mocks/stripe.mock.ts`

The mock Stripe client provides in-memory implementations of key Stripe API methods:

- `customers` - Create, retrieve, update, delete customers
- `subscriptions` - Create, retrieve, update, cancel, list subscriptions
- `invoices` - Create, retrieve, list invoices
- `checkout.sessions` - Create checkout sessions
- `billingPortal.sessions` - Create billing portal sessions

**Key Features:**

- Data persistence within test execution
- Proper error handling (404s, validation errors)
- Type-safe responses matching Stripe's API
- Helper functions for common scenarios

### Test Fixtures

Location: `apps/api/src/test/fixtures/billing.fixtures.ts`

Provides reusable test data including:

- **Test users** - Users with different subscription tiers
- **Subscription plans** - Plan limits and pricing
- **Usage scenarios** - Predefined usage patterns
- **Helper functions** - Calculate costs, check limits

**Available Scenarios:**

- `newFreeUser` - User with free plan, no services
- `starterWithUsage` - Starter plan with active service and usage
- `proWithMultipleServices` - Pro plan with multiple services
- `starterApproachingLimits` - User near plan resource limits
- `pastDueSubscription` - User with past due subscription
- `enterpriseHighUsage` - Enterprise user with high resource usage

## Running Tests

### Unit Tests

Run all billing-related unit tests:

```bash
# Run all API tests
pnpm --filter api test

# Run specific billing test file
pnpm --filter api test src/services/BillingService.test.ts

# Watch mode for development
pnpm --filter api test:watch
```

### Integration Tests

Integration tests require a test database and Redis instance:

1. **Start test containers:**

   ```bash
   docker-compose -f docker-compose.test.yml up -d
   ```

2. **Set environment variables:**

   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/helvetia_test"
   export REDIS_URL="redis://localhost:6380"
   ```

3. **Push database schema:**

   ```bash
   pnpm migrate:dev
   ```

4. **Run integration tests:**

   ```bash
   pnpm --filter api test
   ```

5. **Cleanup:**
   ```bash
   docker-compose -f docker-compose.test.yml down -v
   ```

### Test Coverage

Generate coverage report:

```bash
pnpm --filter api test:coverage
```

View the HTML report at `apps/api/coverage/index.html`.

## Writing Billing Tests

### Unit Test Example

Testing `BillingService.getOrCreateCustomer`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingService } from '../services/BillingService';
import { createMockStripe, resetMockStripe } from '../test/mocks/stripe.mock';
import { testUsers } from '../test/fixtures/billing.fixtures';

// Mock Stripe
vi.mock('../config/stripe', () => ({
  getStripeClient: () => createMockStripe(),
  isStripeConfigured: () => true,
}));

describe('BillingService.getOrCreateCustomer', () => {
  let billingService: BillingService;

  beforeEach(() => {
    resetMockStripe();
    billingService = new BillingService(mockPrisma);
  });

  it('should create a new Stripe customer', async () => {
    const customerId = await billingService.getOrCreateCustomer({
      userId: testUsers.freeUser.id,
      email: testUsers.freeUser.email,
      name: testUsers.freeUser.username,
    });

    expect(customerId).toMatch(/^cus_test_/);
  });

  it('should return existing customer if already exists', async () => {
    // First call creates customer
    const customerId1 = await billingService.getOrCreateCustomer({
      userId: testUsers.freeUser.id,
      email: testUsers.freeUser.email,
      name: testUsers.freeUser.username,
    });

    // Second call returns same customer
    const customerId2 = await billingService.getOrCreateCustomer({
      userId: testUsers.freeUser.id,
      email: testUsers.freeUser.email,
      name: testUsers.freeUser.username,
    });

    expect(customerId1).toBe(customerId2);
  });
});
```

### Integration Test Example

Testing the complete billing flow:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from 'database';
import { buildServer } from './server';
import { billingScenarios } from './test/fixtures/billing.fixtures';

const shouldSkip = !process.env.DATABASE_URL;
const describeIf = shouldSkip ? describe.skip : describe;

describeIf('Billing Integration Tests', () => {
  let app;
  let testUserId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Create test user
    const user = await prisma.user.create({
      data: billingScenarios.starterWithUsage.user,
    });
    testUserId = user.id;

    // Create subscription
    await prisma.subscription.create({
      data: billingScenarios.starterWithUsage.subscription,
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.subscription.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await app.close();
  });

  it('should get user subscription', async () => {
    const token = generateTestToken({ userId: testUserId });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/subscription',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.plan).toBe('STARTER');
    expect(body.status).toBe('ACTIVE');
  });

  it('should create checkout session', async () => {
    const token = generateTestToken({ userId: testUserId });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        priceId: 'price_test_pro_monthly',
        plan: 'PRO',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('sessionId');
    expect(body).toHaveProperty('url');
    expect(body.url).toContain('checkout.stripe.com');
  });
});
```

## Test Fixtures

### Using Predefined Scenarios

```typescript
import { billingScenarios } from './test/fixtures/billing.fixtures';

// Access predefined user data
const user = billingScenarios.starterWithUsage.user;
const subscription = billingScenarios.starterWithUsage.subscription;
const services = billingScenarios.starterWithUsage.services;
const usage = billingScenarios.starterWithUsage.usage;
```

### Creating Custom Fixtures

```typescript
import {
  createSubscriptionFixture,
  createUsageRecordFixture,
} from './test/fixtures/billing.fixtures';

// Create custom subscription
const subscription = createSubscriptionFixture({
  userId: 'user-123',
  plan: 'PRO',
  status: 'ACTIVE',
  stripeCustomerId: 'cus_test_custom',
});

// Create custom usage record
const usage = createUsageRecordFixture({
  serviceId: 'service-456',
  metric: 'COMPUTE_HOURS',
  quantity: 150,
});
```

### Helper Functions

```typescript
import { calculateUsageCost, isWithinPlanLimits } from './test/fixtures/billing.fixtures';

// Calculate expected cost
const cost = calculateUsageCost(
  [
    { metric: 'COMPUTE_HOURS', quantity: 100 },
    { metric: 'MEMORY_GB_HOURS', quantity: 50 },
  ],
  'STARTER',
);

// Check if within limits
const check = isWithinPlanLimits(
  {
    services: 3,
    memoryMB: 1024,
    cpuCores: 1.5,
    bandwidthGB: 50,
    storageGB: 20,
  },
  'STARTER',
);
console.log(check.withinLimits); // true or false
console.log(check.exceeded); // Array of exceeded resources
```

## Mock Stripe Client

### Basic Usage

```typescript
import {
  createMockStripe,
  resetMockStripe,
  mockStripeCustomers,
  mockStripeSubscriptions,
} from './test/mocks/stripe.mock';

// Create mock Stripe instance
const stripe = createMockStripe();

// Reset mock data between tests
beforeEach(() => {
  resetMockStripe();
});

// Use mock methods directly
const customer = await mockStripeCustomers.create({
  email: 'test@example.com',
  name: 'Test User',
});

const subscription = await mockStripeSubscriptions.create({
  customer: customer.id,
  items: [{ price: 'price_test_123' }],
});
```

### Helper Functions

```typescript
import { createTestCustomerWithSubscription } from './test/mocks/stripe.mock';

// Create customer and subscription in one call
const { customer, subscription } = await createTestCustomerWithSubscription({
  email: 'test@example.com',
  name: 'Test User',
  priceId: 'price_test_starter',
  metadata: { userId: 'user-123' },
});
```

### Debugging Mock Data

```typescript
import { getMockData } from './test/mocks/stripe.mock';

// Get all mock data for inspection
const mockData = getMockData();
console.log('Customers:', mockData.customers);
console.log('Subscriptions:', mockData.subscriptions);
console.log('Invoices:', mockData.invoices);
```

## Integration Tests

### Database Setup

Integration tests require:

1. PostgreSQL test database
2. Redis test instance
3. Database schema applied

Configuration is in `vitest.config.ts`:

```typescript
env: {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/helvetia_test',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6380',
  STRIPE_SECRET_KEY: 'sk_test_mock',
  // ... other test env vars
}
```

### Test Isolation

Always clean up test data:

```typescript
afterEach(async () => {
  // Delete test data in reverse order of dependencies
  await prisma.usageRecord.deleteMany({ where: { serviceId: testServiceId } });
  await prisma.service.deleteMany({ where: { userId: testUserId } });
  await prisma.subscription.deleteMany({ where: { userId: testUserId } });
  await prisma.user.delete({ where: { id: testUserId } });
});
```

### Skipping Integration Tests

Integration tests automatically skip when `DATABASE_URL` is not set:

```typescript
const shouldSkip = !process.env.DATABASE_URL;
const describeIf = shouldSkip ? describe.skip : describe;

describeIf('My Integration Test', () => {
  // Tests here
});
```

## Best Practices

### 1. Test Organization

- **Unit tests**: Test services in isolation with mocks
- **Integration tests**: Test complete flows with real database
- **One test, one assertion**: Keep tests focused and clear

### 2. Fixture Usage

- Use predefined scenarios when possible
- Create custom fixtures for edge cases
- Always reset mock data between tests

### 3. Naming Conventions

- **Test files**: `*.test.ts` (unit) or `*.integration.test.ts` (integration)
- **Test descriptions**: Use clear, descriptive names
  - Good: `should create checkout session with valid price ID`
  - Bad: `test checkout`

### 4. Error Testing

Always test error cases:

```typescript
it('should return 404 if subscription not found', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/billing/subscription',
    headers: { authorization: `Bearer ${token}` },
  });

  expect(response.statusCode).toBe(404);
});
```

### 5. Async/Await

Always use async/await for asynchronous operations:

```typescript
// Good
it('should create customer', async () => {
  const customer = await mockStripeCustomers.create({ ... });
  expect(customer.id).toBeDefined();
});

// Bad - missing await
it('should create customer', async () => {
  const customer = mockStripeCustomers.create({ ... });
  expect(customer.id).toBeDefined(); // Will fail!
});
```

### 6. Type Safety

Leverage TypeScript for type-safe tests:

```typescript
import type { SubscriptionPlan } from 'database';

const plan: SubscriptionPlan = 'STARTER'; // Type-safe
```

### 7. Test Data Cleanup

Use `beforeEach` and `afterEach` for setup/teardown:

```typescript
beforeEach(() => {
  resetMockStripe();
});

afterEach(async () => {
  // Clean up database records
  await cleanupTestData();
});
```

## Troubleshooting

### Tests Failing with Stripe Errors

If you see errors like "Stripe is not configured":

1. Check that `STRIPE_SECRET_KEY` is set in test environment
2. Verify mock is properly configured in `vitest.config.ts`
3. Ensure `resetMockStripe()` is called in `beforeEach`

### Database Connection Errors

If integration tests fail with database errors:

1. Verify test containers are running: `docker-compose -f docker-compose.test.yml ps`
2. Check `DATABASE_URL` environment variable
3. Ensure schema is pushed: `pnpm migrate:dev`

### Slow Tests

If tests are running slowly:

1. Use unit tests with mocks when possible
2. Run specific test files during development
3. Use `test:watch` mode for faster feedback
4. Consider parallel test execution

## Additional Resources

- [Integration Tests Guide](../../docs/INTEGRATION_TESTS.md)
- [Test Coverage Report](../../docs/TEST_COVERAGE_REPORT.md)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Vitest Documentation](https://vitest.dev/)

## Example Test Files

See these files for working examples:

- `apps/api/src/services/BillingService.test.ts` - Unit tests for BillingService
- `apps/api/src/controllers/BillingController.test.ts` - Controller tests
- `apps/api/src/billing.integration.test.ts` - Integration tests

## Contributing

When adding new billing features:

1. Add corresponding test fixtures
2. Update mock Stripe client if needed
3. Write both unit and integration tests
4. Update this documentation
5. Ensure tests pass in CI

## Support

For questions or issues with billing tests:

1. Check this documentation
2. Review existing test files for examples
3. Open an issue on GitHub
4. Contact the development team
