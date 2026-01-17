# Billing Tests Documentation

This document provides comprehensive information about the billing test suite, including setup, execution, and coverage details.

## Overview

The billing test suite provides comprehensive coverage for all billing-related functionality, including:

- **Services**: BillingService, SubscriptionService, UsageTrackingService
- **Controllers**: BillingController, StripeWebhookController
- **Stripe Integration**: Mock Stripe client for isolated testing
- **Edge Cases**: Date validation, error handling, resource limits

## Test Structure

```
apps/api/src/
├── services/
│   ├── BillingService.test.ts           # Unit tests for Stripe operations
│   ├── SubscriptionService.test.ts      # Unit tests for subscription management
│   └── UsageTrackingService.test.ts     # Unit tests for usage tracking
├── controllers/
│   ├── BillingController.test.ts        # Integration tests for billing endpoints
│   └── StripeWebhookController.test.ts  # Integration tests for Stripe webhooks
└── test/
    ├── mocks/
    │   └── stripe.mock.ts               # Mock Stripe client and objects
    └── fixtures/
        └── billing.fixtures.ts          # Test data fixtures
```

## Prerequisites

- Node.js v20+
- PostgreSQL (for integration tests)
- Redis (for integration tests)
- Environment variables configured (see `.env.test.example`)

## Running Tests

### Run All Billing Tests

```bash
# From project root
pnpm --filter api test

# Run only billing-related tests
pnpm --filter api test -- --testPathPattern=billing
pnpm --filter api test -- --testPathPattern=Billing
pnpm --filter api test -- --testPathPattern=Subscription
pnpm --filter api test -- --testPathPattern=Usage
pnpm --filter api test -- --testPathPattern=Webhook
```

### Run Specific Test Files

```bash
# Service tests
pnpm --filter api test -- BillingService.test.ts
pnpm --filter api test -- SubscriptionService.test.ts
pnpm --filter api test -- UsageTrackingService.test.ts

# Controller tests
pnpm --filter api test -- BillingController.test.ts
pnpm --filter api test -- StripeWebhookController.test.ts
```

### Run with Coverage

```bash
# Generate coverage report
pnpm --filter api test:coverage

# View coverage report
open apps/api/coverage/index.html
```

### Watch Mode

```bash
# Run tests in watch mode for development
pnpm --filter api test:watch
```

## Test Coverage

### Coverage Targets

All billing modules target **>80% code coverage**:

- **BillingService**: >80% (all methods, error cases, edge cases)
- **SubscriptionService**: >80% (CRUD operations, resource limits)
- **UsageTrackingService**: >80% (usage recording, aggregation, cost calculation)
- **BillingController**: >80% (all endpoints, validation, authorization)
- **StripeWebhookController**: >80% (all event types, signature verification)

### Current Coverage

Run `pnpm --filter api test:coverage` to see current coverage metrics.

## Test Categories

### 1. Service Unit Tests

#### BillingService Tests

Tests Stripe integration without actual API calls:

- **Customer Management**: Create/retrieve customers
- **Subscription Management**: Create, update, cancel subscriptions
- **Checkout & Portal**: Create Stripe sessions
- **Invoices**: List customer invoices
- **Usage Reporting**: Report metered usage to Stripe
- **Error Handling**: Stripe not configured, API errors
- **Status Mapping**: Map Stripe statuses to internal enums

**Key Test Cases:**
- Returns existing customer ID if subscription exists
- Creates new Stripe customer if needed
- Maps subscription statuses correctly (active, trialing, past_due, canceled)
- Handles Stripe errors gracefully
- Validates Stripe configuration

#### SubscriptionService Tests

Tests database operations for subscriptions:

- **CRUD Operations**: Get, create, update subscriptions
- **Status Management**: Update subscription status
- **Resource Limits**: Return correct limits per plan
- **Active Status**: Check if subscription is active
- **Edge Cases**: Null subscription IDs, boundary dates

**Key Test Cases:**
- Retrieves subscription for user/organization
- Creates new subscription if none exists
- Updates existing subscription
- Returns correct resource limits for each plan (FREE, STARTER, PRO, ENTERPRISE)
- Validates that either userId or organizationId is provided

#### UsageTrackingService Tests

Tests usage recording and cost calculation:

- **Usage Recording**: Record metrics for services
- **Service Usage**: Get aggregated usage for a service
- **Aggregated Usage**: Get usage across all user services
- **Cost Calculation**: Calculate costs per metric
- **Date Ranges**: Handle various date ranges correctly

**Key Test Cases:**
- Records usage with correct timestamps
- Aggregates usage by metric type
- Calculates costs using correct pricing constants
- Handles null/zero quantities
- Returns empty array for users with no services

### 2. Controller Integration Tests

#### BillingController Tests

Tests HTTP endpoints for billing operations:

**Endpoints Tested:**
- `GET /billing/subscription` - Get current subscription
- `POST /billing/checkout` - Create checkout session
- `POST /billing/portal` - Create billing portal session
- `GET /billing/invoices` - Get customer invoices
- `GET /billing/usage` - Get usage for current billing period
- `GET /billing/usage/history` - Get usage for custom date range
- `GET /billing/usage/service/:id` - Get usage for specific service

**Key Test Cases:**
- Returns 401 for unauthenticated requests
- Returns 404 when resources not found
- Validates request parameters (dates, priceId, plan)
- Enforces date range limits (max 1 year, no future dates)
- Returns proper error messages and status codes
- Logs errors for debugging

#### StripeWebhookController Tests

Tests webhook event handling:

**Events Tested:**
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription changes
- `customer.subscription.deleted` - Canceled subscription
- `invoice.paid` - Successful payment
- `invoice.payment_failed` - Failed payment

**Key Test Cases:**
- Verifies webhook signature
- Rejects malformed JSON
- Rejects missing/invalid signatures
- Handles all supported event types
- Maps Stripe plans to internal plans (STARTER, PRO, ENTERPRISE)
- Defaults to FREE for unknown plans
- Handles organization vs user subscriptions
- Logs unhandled event types
- Returns 500 for handler errors

## Mock Objects

### Mock Stripe Client

Located in `apps/api/src/test/mocks/stripe.mock.ts`:

**Functions:**
- `createMockStripe()` - Create mock Stripe client with all methods
- `createMockCustomer()` - Create mock Stripe customer object
- `createMockSubscription()` - Create mock Stripe subscription object
- `createMockInvoice()` - Create mock Stripe invoice object
- `createMockCheckoutSession()` - Create mock checkout session object
- `createMockPortalSession()` - Create mock billing portal session object
- `createMockWebhookEvent()` - Create mock Stripe webhook event

**Usage:**
```typescript
import { createMockStripe, createMockSubscription } from '../test/mocks/stripe.mock';

const mockStripe = createMockStripe();
const mockSub = createMockSubscription({ status: 'active' });
mockStripe.subscriptions.retrieve.mockResolvedValue(mockSub);
```

### Test Fixtures

Located in `apps/api/src/test/fixtures/billing.fixtures.ts`:

**Available Fixtures:**
- `testUsers` - Sample user objects
- `testOrganizations` - Sample organization objects
- `testSubscriptions` - Sample subscriptions (free, starter, pro, pastDue, canceled)
- `testServices` - Sample service objects
- `testUsageRecords` - Sample usage records
- `testPriceIds` - Stripe price IDs for testing
- `planLimits` - Expected resource limits per plan
- `usagePricing` - Expected pricing per usage metric

**Usage:**
```typescript
import { testSubscriptions, planLimits } from '../test/fixtures/billing.fixtures';

expect(subscription).toEqual(testSubscriptions.starter);
expect(limits).toEqual(planLimits.PRO);
```

## Common Patterns

### Testing Stripe Operations

```typescript
// Mock Stripe client
const mockStripe = createMockStripe();
vi.mocked(getStripeClient).mockReturnValue(mockStripe);

// Mock Stripe response
mockStripe.subscriptions.create.mockResolvedValue(createMockSubscription());

// Call service method
const result = await billingService.createSubscription({
  customerId: 'cus_test',
  priceId: 'price_test',
});

// Verify Stripe was called
expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
  customer: 'cus_test',
  items: [{ price: 'price_test' }],
  // ...
});
```

### Testing Controllers

```typescript
// Mock request/reply
const mockRequest = {
  user: { id: 'user-1' },
  body: { priceId: 'price_test', plan: 'STARTER' },
  log: { error: vi.fn(), info: vi.fn() },
};

const mockReply = {
  status: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
};

// Call controller method
await controller.createCheckoutSession(mockRequest, mockReply);

// Verify response
expect(mockReply.status).toHaveBeenCalledWith(200);
expect(mockReply.send).toHaveBeenCalledWith({ sessionId: expect.any(String) });
```

### Testing Webhooks

```typescript
// Create webhook event
const mockEvent = createMockWebhookEvent(
  'customer.subscription.created',
  createMockSubscription({ status: 'active' })
);

// Mock Stripe webhook signature verification
mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

// Mock request with signature
mockRequest.headers = { 'stripe-signature': 'test_signature' };
mockRequest.rawBody = Buffer.from(JSON.stringify(mockEvent));

// Call webhook handler
await controller.handleWebhook(mockRequest, mockReply);

// Verify subscription was created
expect(mockSubscriptionService.upsertSubscription).toHaveBeenCalled();
```

## Troubleshooting

### Tests Failing Due to Missing Environment Variables

Ensure test environment variables are set in `vitest.config.ts`:

```typescript
env: {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/helvetia_test',
  REDIS_URL: 'redis://localhost:6380',
  STRIPE_SECRET_KEY: 'sk_test_...',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_...',
  // ...
}
```

### Stripe Mock Not Working

Ensure Stripe config is mocked at the top of your test file:

```typescript
vi.mock('../config/stripe', () => ({
  getStripeClient: vi.fn(),
  isStripeConfigured: vi.fn(),
}));
```

### Database Errors in Tests

Tests use mock Prisma client by default. If you need real database:

1. Start test database: `docker-compose -f docker-compose.test.yml up -d`
2. Run migrations: `pnpm --filter api db:push`
3. Run tests: `pnpm --filter api test`

### Webhook Signature Verification Failing

Mock the constructEvent method:

```typescript
mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
```

Ensure rawBody is provided:

```typescript
mockRequest.rawBody = Buffer.from(JSON.stringify({ type: 'test' }));
```

## Adding New Tests

### Adding a Service Test

1. Create test file: `src/services/YourService.test.ts`
2. Import mocks and fixtures
3. Set up beforeEach with mocks
4. Write test cases for each method
5. Test error cases and edge cases

### Adding a Controller Test

1. Create test file: `src/controllers/YourController.test.ts`
2. Mock all dependencies
3. Create mock request/reply objects
4. Test all endpoints
5. Test authorization, validation, error handling

### Adding Test Fixtures

1. Edit `src/test/fixtures/billing.fixtures.ts`
2. Add new fixture objects
3. Export for use in tests
4. Document fixture structure

## Best Practices

1. **Use Fixtures**: Reuse test data from fixtures for consistency
2. **Mock External Services**: Always mock Stripe API calls
3. **Test Error Cases**: Test both success and failure paths
4. **Test Edge Cases**: Null values, boundary conditions, concurrent operations
5. **Clear Descriptions**: Use descriptive test names
6. **Isolate Tests**: Each test should be independent
7. **Clean Up**: Reset mocks in beforeEach
8. **Assertions**: Make specific assertions, not just "toBeDefined"

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Push to main branch
- Manual workflow trigger

CI Configuration: `.github/workflows/test.yml`

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Fastify Testing](https://fastify.dev/docs/latest/Guides/Testing/)
- [TypeScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Support

For questions or issues with billing tests:

1. Check this documentation
2. Review existing test files for patterns
3. Check Vitest/Stripe documentation
4. Ask in the team chat or create an issue
