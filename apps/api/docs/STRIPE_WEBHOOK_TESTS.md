# Stripe Webhook Tests Documentation

This document provides comprehensive information about testing Stripe webhook functionality in Helvetia Cloud.

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Writing Webhook Tests](#writing-webhook-tests)
- [Test Fixtures](#test-fixtures)
- [Best Practices](#best-practices)

## Overview

The Stripe webhook integration handles critical subscription lifecycle events from Stripe. Our test infrastructure provides:

- **Mock webhook events** - Predefined Stripe event payloads
- **Signature verification** - Helper functions for generating valid webhook signatures
- **Integration tests** - End-to-end webhook processing tests
- **Test fixtures** - Reusable Stripe objects (customers, subscriptions, invoices)

## Test Infrastructure

### Webhook Event Fixtures

Location: `apps/api/src/test/fixtures/stripe-webhook.fixtures.ts`

The fixture file provides helper functions for creating mock Stripe webhook events:

**Mock Object Creators:**

- `createMockStripeSubscription()` - Creates a Stripe subscription object
- `createMockStripeCustomer()` - Creates a Stripe customer object
- `createMockStripeInvoice()` - Creates a Stripe invoice object
- `createMockStripeWebhookEvent()` - Wraps objects in webhook event structure

**Predefined Webhook Events:**

- `webhookEventFixtures.subscriptionCreated()` - customer.subscription.created event
- `webhookEventFixtures.subscriptionUpdated()` - customer.subscription.updated event
- `webhookEventFixtures.subscriptionDeleted()` - customer.subscription.deleted event
- `webhookEventFixtures.invoicePaid()` - invoice.paid event
- `webhookEventFixtures.invoicePaymentFailed()` - invoice.payment_failed event

**Signature Generation:**

- `generateStripeWebhookSignature()` - Creates valid Stripe webhook signature for testing

### Integration Tests

Location: `apps/api/src/controllers/StripeWebhookController.integration.test.ts`

The integration test suite covers:

1. **Signature Verification**
   - Valid signature acceptance
   - Invalid signature rejection
   - Missing signature header handling
   - Malformed JSON handling

2. **Subscription Events**
   - subscription.created - Creates subscription in database
   - subscription.updated - Updates subscription status
   - subscription.deleted - Marks subscription as canceled

3. **Invoice Events**
   - invoice.paid - Activates past due subscriptions
   - invoice.payment_failed - Marks subscriptions as past due

4. **Error Scenarios**
   - Missing Stripe configuration
   - Missing webhook secret
   - Customer not found errors
   - Unhandled event types

5. **Edge Cases**
   - Empty payloads
   - Large payloads
   - Concurrent webhook requests
   - Plan mapping (STARTER, PRO, ENTERPRISE)

## Running Tests

### Unit Tests

The webhook controller is tested through integration tests rather than isolated unit tests, as webhook processing requires the full Fastify server setup and database interactions.

### Integration Tests

Integration tests require:

- A test database connection
- Stripe environment variables configured
- The RUN_INTEGRATION_TESTS flag set

**Setup:**

1. **Start test database:**

   ```bash
   docker-compose -f docker-compose.test.yml up -d postgres
   ```

2. **Set environment variables:**

   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/helvetia_test"
   export REDIS_URL="redis://localhost:6380"
   export RUN_INTEGRATION_TESTS=1
   export STRIPE_SECRET_KEY="sk_test_mock_key"
   export STRIPE_WEBHOOK_SECRET="whsec_test_secret"
   export STRIPE_PRICE_ID_STARTER="price_test_starter"
   export STRIPE_PRICE_ID_PRO="price_test_pro"
   export STRIPE_PRICE_ID_ENTERPRISE="price_test_enterprise"
   ```

3. **Push database schema:**

   ```bash
   pnpm db:push
   ```

4. **Run integration tests:**

   ```bash
   # Run all integration tests including Stripe webhook tests
   RUN_INTEGRATION_TESTS=1 pnpm --filter api test StripeWebhookController.integration.test.ts

   # Or run all integration tests
   RUN_INTEGRATION_TESTS=1 pnpm --filter api test
   ```

**Quick Run (with environment variables inline):**

```bash
RUN_INTEGRATION_TESTS=1 \
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/helvetia_test" \
REDIS_URL="redis://localhost:6380" \
STRIPE_SECRET_KEY="sk_test_mock" \
STRIPE_WEBHOOK_SECRET="whsec_test_secret" \
STRIPE_PRICE_ID_STARTER="price_test_starter" \
STRIPE_PRICE_ID_PRO="price_test_pro" \
STRIPE_PRICE_ID_ENTERPRISE="price_test_enterprise" \
pnpm --filter api test StripeWebhookController.integration.test.ts
```

### Without Integration Tests

By default, integration tests are skipped if `RUN_INTEGRATION_TESTS` is not set:

```bash
# This will skip Stripe webhook integration tests
pnpm --filter api test StripeWebhookController.integration.test.ts
```

## Test Coverage

The test suite covers the following webhook event types and scenarios:

### Supported Webhook Events

| Event Type                      | Coverage        | Description                           |
| ------------------------------- | --------------- | ------------------------------------- |
| `customer.subscription.created` | ✅ Complete     | Creates subscription for user/org     |
| `customer.subscription.updated` | ✅ Complete     | Updates subscription status           |
| `customer.subscription.deleted` | ✅ Complete     | Marks subscription as canceled        |
| `invoice.paid`                  | ✅ Complete     | Activates subscriptions after payment |
| `invoice.payment_failed`        | ✅ Complete     | Marks subscriptions as past due       |
| Other events                    | ✅ Acknowledged | Returns 200 but not processed         |

### Test Scenarios

**Signature Verification:**

- ✅ Valid signature acceptance
- ✅ Invalid signature rejection
- ✅ Missing signature header
- ✅ Malformed JSON payloads

**Subscription Management:**

- ✅ User subscription creation
- ✅ Organization subscription creation
- ✅ Plan mapping (STARTER, PRO, ENTERPRISE)
- ✅ Status transitions (active, past_due, canceled, trialing)
- ✅ Subscription updates
- ✅ Subscription deletion

**Invoice Processing:**

- ✅ Invoice paid handling
- ✅ Payment failure handling
- ✅ Subscription status updates

**Error Handling:**

- ✅ Missing Stripe configuration
- ✅ Missing webhook secret
- ✅ Customer not found
- ✅ Unhandled event types

**Edge Cases:**

- ✅ Empty payloads
- ✅ Large payloads (100KB+)
- ✅ Concurrent webhook processing

## Writing Webhook Tests

### Basic Test Structure

```typescript
import {
  generateStripeWebhookSignature,
  webhookEventFixtures,
} from '../test/fixtures/stripe-webhook.fixtures';

it('should handle subscription created event', async () => {
  // 1. Create webhook event
  const event = webhookEventFixtures.subscriptionCreated('cus_test_123', 'price_test_starter');

  // 2. Generate signature
  const payload = JSON.stringify(event);
  const signature = generateStripeWebhookSignature(payload, webhookSecret);

  // 3. Send webhook request
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    payload,
  });

  // 4. Verify response
  expect(response.statusCode).toBe(200);
  expect(JSON.parse(response.body)).toHaveProperty('received', true);

  // 5. Verify database changes
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: 'sub_test_created' },
  });
  expect(subscription).toBeDefined();
});
```

### Creating Custom Webhook Events

```typescript
import {
  createMockStripeWebhookEvent,
  createMockStripeSubscription,
} from '../test/fixtures/stripe-webhook.fixtures';

// Create a custom subscription event
const subscription = createMockStripeSubscription({
  id: 'sub_custom_123',
  customer: 'cus_custom_456',
  status: 'trialing',
  metadata: { customField: 'value' },
});

const event = createMockStripeWebhookEvent('customer.subscription.created', {
  object: subscription,
  previous_attributes: undefined,
});
```

### Testing Signature Verification

```typescript
it('should reject invalid signature', async () => {
  const event = webhookEventFixtures.subscriptionCreated();
  const payload = JSON.stringify(event);

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 't=1234567890,v1=invalidSignature',
    },
    payload,
  });

  expect(response.statusCode).toBe(400);
  expect(JSON.parse(response.body)).toHaveProperty(
    'error',
    'Webhook signature verification failed',
  );
});
```

### Testing Database Updates

```typescript
it('should update subscription status on webhook', async () => {
  // Create initial subscription
  await prisma.subscription.create({
    data: {
      userId: testUserId,
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      plan: 'STARTER',
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Send webhook to update status
  const event = webhookEventFixtures.subscriptionUpdated('sub_test', 'past_due');
  const payload = JSON.stringify(event);
  const signature = generateStripeWebhookSignature(payload, webhookSecret);

  await app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    payload,
  });

  // Verify update
  const updatedSub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: 'sub_test' },
  });
  expect(updatedSub?.status).toBe('PAST_DUE');
});
```

## Test Fixtures

### Available Fixture Functions

**Subscription Events:**

```typescript
// Create subscription.created event
const event = webhookEventFixtures.subscriptionCreated(
  'cus_customer_id', // Customer ID
  'price_starter', // Price ID
);

// Create subscription.updated event
const event = webhookEventFixtures.subscriptionUpdated(
  'sub_subscription_id', // Subscription ID
  'past_due', // New status
);

// Create subscription.deleted event
const event = webhookEventFixtures.subscriptionDeleted('sub_subscription_id');
```

**Invoice Events:**

```typescript
// Create invoice.paid event
const event = webhookEventFixtures.invoicePaid(
  'sub_subscription_id', // Subscription ID
  'cus_customer_id', // Customer ID
);

// Create invoice.payment_failed event
const event = webhookEventFixtures.invoicePaymentFailed('sub_subscription_id', 'cus_customer_id');
```

**Custom Objects:**

```typescript
// Create custom customer
const customer = createMockStripeCustomer({
  id: 'cus_custom',
  email: 'custom@example.com',
  metadata: { userId: 'user-123' },
});

// Create custom subscription
const subscription = createMockStripeSubscription({
  id: 'sub_custom',
  customer: 'cus_custom',
  status: 'active',
  items: {
    object: 'list',
    data: [
      /* custom items */
    ],
    has_more: false,
    url: '/v1/subscription_items',
  },
});

// Create custom invoice
const invoice = createMockStripeInvoice({
  id: 'in_custom',
  customer: 'cus_custom',
  subscription: 'sub_custom',
  amount_due: 5000,
  paid: true,
});
```

## Best Practices

### 1. Use Fixtures for Consistency

Always use the provided fixtures rather than creating events from scratch:

```typescript
// ✅ Good - Using fixture
const event = webhookEventFixtures.subscriptionCreated();

// ❌ Bad - Manual event creation
const event = {
  type: 'customer.subscription.created',
  data: {
    /* manually constructed */
  },
};
```

### 2. Test Signature Verification

Always include signature verification in your webhook tests:

```typescript
const payload = JSON.stringify(event);
const signature = generateStripeWebhookSignature(payload, webhookSecret);
```

### 3. Clean Up Test Data

Use `beforeEach` and `afterAll` hooks to clean up test data:

```typescript
beforeEach(async () => {
  await prisma.subscription.deleteMany({
    where: { userId: testUserId },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: testUserId } });
  await prisma.$disconnect();
});
```

### 4. Test Both Success and Failure Cases

Cover both happy paths and error scenarios:

```typescript
describe('Subscription Created', () => {
  it('should create subscription successfully', async () => {
    // Test success case
  });

  it('should handle customer not found error', async () => {
    // Test error case
  });
});
```

### 5. Verify Database State

Always verify that webhook processing resulted in the expected database changes:

```typescript
// Send webhook
await sendWebhook(event);

// Verify database state
const subscription = await prisma.subscription.findFirst({
  where: { stripeSubscriptionId: 'sub_test' },
});
expect(subscription?.status).toBe('ACTIVE');
```

### 6. Test Concurrent Webhooks

Stripe may send webhooks concurrently, so test this scenario:

```typescript
const [response1, response2] = await Promise.all([sendWebhook(event1), sendWebhook(event2)]);

expect(response1.statusCode).toBe(200);
expect(response2.statusCode).toBe(200);
```

### 7. Use Descriptive Test Names

Make test names clear and descriptive:

```typescript
// ✅ Good
it('should update subscription to PAST_DUE when invoice payment fails', async () => {
  // ...
});

// ❌ Bad
it('should work', async () => {
  // ...
});
```

## Troubleshooting

### Tests are Skipped

If integration tests are skipped, ensure `RUN_INTEGRATION_TESTS=1` is set:

```bash
RUN_INTEGRATION_TESTS=1 pnpm --filter api test StripeWebhookController
```

### Database Connection Errors

Ensure the test database is running and the connection string is correct:

```bash
docker-compose -f docker-compose.test.yml up -d postgres
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/helvetia_test"
```

### Signature Verification Failures

Verify that:

1. The webhook secret matches between test and controller
2. The signature is generated with the exact payload string
3. The timestamp in the signature is recent (not too old)

### Mock Stripe API Calls

Note: The current tests may fail when the controller tries to call real Stripe APIs (e.g., `customers.retrieve`). In a production test setup, you would:

1. Mock the Stripe client in the dependency injection container
2. Use tools like `nock` or `msw` to intercept HTTP requests
3. Implement a test-specific Stripe client factory

Example using DI mocking:

```typescript
import { container } from 'tsyringe';
import { TOKENS } from '../di/tokens';

beforeAll(() => {
  // Replace Stripe client with mock
  container.register(TOKENS.Stripe, {
    useValue: mockStripeClient,
  });
});
```

## References

- [Stripe Webhook Testing Documentation](https://stripe.com/docs/webhooks/test)
- [Stripe Event Types](https://stripe.com/docs/api/events/types)
- [Vitest Documentation](https://vitest.dev/)
- [Fastify Testing](https://www.fastify.io/docs/latest/Guides/Testing/)
