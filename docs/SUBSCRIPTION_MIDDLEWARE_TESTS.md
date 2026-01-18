# Subscription Middleware and Enforcement Tests

This document describes the comprehensive test coverage for subscription middleware and resource enforcement logic implemented for issue #259.

## Overview

The subscription system enforces plan-based resource limits and manages subscription status transitions. This test suite ensures that:

1. Subscription status checks work correctly
2. Resource limits are properly enforced
3. Edge cases are handled appropriately
4. Stripe webhook events are processed correctly

## Test Files

### 1. `apps/api/src/middleware/subscription.middleware.test.ts`

**29 comprehensive unit tests** covering subscription middleware logic.

#### Test Categories

##### Active Subscription Tests

- ✅ Allow access for ACTIVE subscription
- ✅ Block access when no subscription found
- ✅ Block access when user is not authenticated

##### Grace Period Tests

- ✅ Allow access for PAST_DUE subscription within grace period (< 7 days)
- ✅ Allow access for PAST_DUE at day 0 (just expired)
- ✅ Allow access for PAST_DUE just under 7 days (6d 23h 59m 59s)
- ✅ Block access for PAST_DUE just over 7 days (7d and 1s)
- ✅ Block access for PAST_DUE at day 15 (well beyond grace period)

##### Status Transition Tests

- ✅ Block access for CANCELED subscription
- ✅ Block access for UNPAID subscription
- ✅ Block access for unknown subscription status
- ✅ Properly handle ACTIVE → CANCELED transition
- ✅ Properly handle PAST_DUE → UNPAID transition

##### Service Count Enforcement Tests

- ✅ Allow service creation when under limit
- ✅ Block service creation when at limit (exact boundary)
- ✅ Allow unlimited services for ENTERPRISE plan
- ✅ Enforce lower limits after downgrade (PRO → STARTER)
- ✅ Allow more resources after upgrade (FREE → PRO)

##### Memory Enforcement Tests

- ✅ Allow service creation when memory is under limit
- ✅ Block service creation when memory exceeds limit
- ✅ Enforce exact limit boundary for memory
- ✅ Handle service with no explicit memory limit (default 512MB)

##### CPU Enforcement Tests

- ✅ Allow service creation when CPU is under limit
- ✅ Block service creation when CPU exceeds limit
- ✅ Handle service with no explicit CPU limit (default 0.5 cores)

##### Authentication Edge Cases

- ✅ Throw error when user is missing from request
- ✅ Throw error when subscription not found for resource enforcement

### 2. `apps/api/src/middleware/subscription-webhooks.test.ts`

**15 comprehensive tests** for Stripe webhook event handling.

#### Test Categories

##### Subscription Status Updates

- ✅ Update subscription status from ACTIVE to PAST_DUE
- ✅ Update subscription status from PAST_DUE to ACTIVE (payment recovered)
- ✅ Update subscription status to CANCELED
- ✅ Update subscription status to UNPAID

##### Plan Changes

- ✅ Handle plan upgrade from STARTER to PRO
- ✅ Handle plan downgrade from PRO to STARTER
- ✅ Reflect new limits immediately after plan upgrade
- ✅ Reflect new limits immediately after plan downgrade

##### Subscription Lifecycle

- ✅ Mark subscription as CANCELED when deleted
- ✅ Update period dates on successful renewal
- ✅ Handle failed renewal (payment failed)
- ✅ Handle subscription with trial period ending

##### Edge Cases

- ✅ Handle webhook for non-existent subscription gracefully
- ✅ Handle multiple rapid status changes
- ✅ Handle subscription reactivation after cancellation

## Key Implementation Details

### Grace Period Logic

The system implements a 7-day grace period for `PAST_DUE` subscriptions:

```typescript
const gracePeriodDays = 7;
const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
const timeSinceExpiry = now.getTime() - periodEnd.getTime();

if (timeSinceExpiry < gracePeriodMs) {
  // Within grace period - allow access
  return;
}
// Beyond grace period - block access
throw new ForbiddenError('...');
```

**Grace Period Behavior:**

- Day 0 (just expired): ✅ Allow
- Day 6, 23:59:59: ✅ Allow
- Day 7, 00:00:00: ❌ Block
- Day 7+: ❌ Block

### Resource Limit Enforcement

Resource limits are checked **before** creating new services:

```typescript
if (totalMemoryAfterCreation > limits.maxMemoryMB) {
  throw new ForbiddenError('Memory limit exceeded...');
}
```

**Boundary Behavior:**

- At limit: ✅ Allow (e.g., 512MB/512MB)
- Over limit: ❌ Block (e.g., 513MB/512MB)

### Plan Limits

| Plan       | Services | Memory | CPU | Bandwidth | Storage |
| ---------- | -------- | ------ | --- | --------- | ------- |
| FREE       | 1        | 512MB  | 0.5 | 10GB      | 5GB     |
| STARTER    | 5        | 2048MB | 2   | 100GB     | 50GB    |
| PRO        | 20       | 8192MB | 8   | 500GB     | 200GB   |
| ENTERPRISE | ∞        | ∞      | ∞   | ∞         | ∞       |

### Stripe Webhook Events Handled

#### subscription.updated

- Status changes (active, past_due, canceled, unpaid)
- Plan upgrades/downgrades
- Period date updates

#### subscription.deleted

- Marks subscription as CANCELED

#### invoice.payment_failed

- Transitions subscription to PAST_DUE

## Running Tests

### Run all subscription tests:

```bash
cd apps/api
pnpm test -- subscription
```

### Run only middleware tests:

```bash
pnpm test subscription.middleware.test.ts
```

### Run only webhook tests:

```bash
pnpm test subscription-webhooks.test.ts
```

### Run with coverage:

```bash
pnpm test:coverage -- subscription
```

## Test Mocking Strategy

### Subscription Service Mock

All tests mock the `ISubscriptionService` interface:

```typescript
mockSubscriptionService = {
  getSubscription: vi.fn(),
  upsertSubscription: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  hasActiveSubscription: vi.fn(),
  getResourceLimits: vi.fn(),
};
```

### Prisma Mock

Resource enforcement tests mock Prisma database queries:

```typescript
mockPrisma = {
  service: {
    count: vi.fn(), // For service count limits
    findMany: vi.fn(), // For memory/CPU calculations
  },
};
```

### Stripe Event Simulation

Webhook tests simulate Stripe events:

```typescript
const stripeEvent = {
  type: 'customer.subscription.updated',
  data: {
    object: {
      id: 'sub_stripe_123',
      status: 'past_due',
      current_period_start: timestamp,
      current_period_end: timestamp,
    },
  },
};
```

## Edge Cases Covered

1. **Time Boundaries**: Tests exact grace period boundaries (day 0, day 7)
2. **Limit Boundaries**: Tests exact resource limits (at limit vs over limit)
3. **Status Transitions**: Tests all valid subscription status changes
4. **Plan Changes**: Tests upgrade and downgrade scenarios
5. **Missing Data**: Tests handling of missing users, subscriptions
6. **Rapid Changes**: Tests multiple rapid webhook events
7. **Reactivation**: Tests subscription cancellation and reactivation
8. **Default Values**: Tests behavior when memory/CPU limits not specified

## Security Validation

All code has been validated with CodeQL:

- ✅ 0 security alerts
- ✅ No vulnerabilities detected
- ✅ Safe input handling
- ✅ Proper error handling

## Test Results

```
✓ subscription.middleware.test.ts (29 tests) 23ms
✓ subscription-webhooks.test.ts (15 tests) 16ms

Test Files  2 passed (2)
Tests       44 passed (44)
```

## Related Files

- **Implementation**: `apps/api/src/middleware/subscription.middleware.ts`
- **Service**: `apps/api/src/services/SubscriptionService.ts`
- **Service Tests**: `apps/api/src/services/SubscriptionService.test.ts`
- **Integration Tests**: `apps/api/src/subscription-enforcement.integration.test.ts`
- **Interface**: `apps/api/src/interfaces/ISubscriptionService.ts`

## Future Improvements

While comprehensive, additional test scenarios could include:

1. **Concurrent Operations**: Test simultaneous resource allocations
2. **Webhook Retry Logic**: Test Stripe webhook retry behavior
3. **Rate Limiting**: Test subscription checks under high load
4. **Organization Subscriptions**: Test organization-level subscriptions (currently user-focused)
5. **Usage Tracking**: Integration with actual usage metrics

## References

- Issue: [ramiz4/helvetia-cloud#259](https://github.com/ramiz4/helvetia-cloud/issues/259)
- Sub-issue: Middleware & Enforcement Tests for Subscription and Resource Limits
- Stripe API: [Subscription Webhooks Documentation](https://stripe.com/docs/api/subscriptions)
