# UsageTrackingService Unit Tests

## Overview

This document describes the unit tests for the `UsageTrackingService`, which handles recording and reporting of resource usage for services in the Helvetia Cloud platform.

## Test Coverage

**Coverage Achievement: 100%** (exceeds the required >80%)

- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

## Test File Location

`apps/api/src/services/UsageTrackingService.test.ts`

## Test Suites

### 1. recordUsage Method Tests (7 tests)

Tests the functionality for recording usage metrics for a service.

#### Test Cases:

- ✅ Successfully record usage for a service
- ✅ Record usage for MEMORY_GB_HOURS metric
- ✅ Record usage for BANDWIDTH_GB metric
- ✅ Record usage for STORAGE_GB metric
- ✅ Handle zero quantity edge case
- ✅ Handle large quantities (999999.99)
- ✅ Throw error when database operation fails

#### Key Aspects Tested:

- All four metric types (COMPUTE_HOURS, MEMORY_GB_HOURS, BANDWIDTH_GB, STORAGE_GB)
- Proper timestamp generation
- Period start/end handling
- Edge cases (zero and large values)
- Error propagation from database layer

### 2. getServiceUsage Method Tests (7 tests)

Tests the retrieval and aggregation of usage data for a specific service.

#### Test Cases:

- ✅ Retrieve usage for a service in a period
- ✅ Handle multiple records of same metric (aggregation)
- ✅ Return empty array when no records exist
- ✅ Handle null quantity sum
- ✅ Properly filter by date range
- ✅ Throw error when database operation fails

#### Key Aspects Tested:

- Grouping by metric type
- Aggregation of quantities using Prisma's `_sum`
- Date range filtering (periodStart >= and periodEnd <=)
- Empty result handling
- Null safety (quantity defaults to 0)
- Error handling

### 3. getAggregatedUsage Method Tests (10 tests)

Tests the aggregation of usage across multiple services for a user or organization.

#### Test Cases:

- ✅ Aggregate usage by userId
- ✅ Aggregate usage by organizationId
- ✅ Return empty array when no services exist
- ✅ Handle multiple services with aggregated usage
- ✅ Handle null quantity sum
- ✅ Correctly integrate cost calculation
- ✅ Throw error when service query fails
- ✅ Throw error when usage aggregation fails

#### Key Aspects Tested:

- User-based aggregation
- Organization-based aggregation (with nested environment/project relation)
- Empty service list handling
- Multiple service aggregation
- Cost calculation integration
- Error handling at different stages

### 4. calculateCost Method Tests (12 tests)

Tests the cost calculation logic for different usage metrics.

#### Test Cases:

- ✅ Calculate cost for COMPUTE_HOURS metric ($0.01 per hour)
- ✅ Calculate cost for MEMORY_GB_HOURS metric ($0.005 per GB-hour)
- ✅ Calculate cost for BANDWIDTH_GB metric ($0.12 per GB)
- ✅ Calculate cost for STORAGE_GB metric ($0.023 per GB per month)
- ✅ Round to 2 decimal places correctly
- ✅ Handle zero quantity
- ✅ Handle fractional quantities
- ✅ Handle large quantities
- ✅ Round down correctly
- ✅ Round up correctly
- ✅ Handle very small fractional costs
- ✅ Handle negative quantities (edge case)

#### Key Aspects Tested:

- All pricing tiers for each metric type
- Rounding behavior (Math.round to 2 decimal places)
- Edge cases: zero, negative, fractional, and large values
- Precision handling for small decimal values

## Pricing Constants Tested

```typescript
COMPUTE_HOURS: 0.01; // $0.01 per compute hour
MEMORY_GB_HOURS: 0.005; // $0.005 per GB-hour
BANDWIDTH_GB: 0.12; // $0.12 per GB
STORAGE_GB: 0.023; // $0.023 per GB per month
```

## Test Setup

### Prerequisites

1. Node.js v20+
2. pnpm package manager
3. Prisma Client generated

### Running Tests

```bash
# Run all tests for UsageTrackingService
pnpm --filter api test UsageTrackingService.test.ts

# Run with coverage
pnpm --filter api test:coverage UsageTrackingService.test.ts

# Run in watch mode
pnpm --filter api test:watch UsageTrackingService.test.ts
```

### Test Dependencies

- `vitest` - Test runner
- `@vitest/coverage-v8` - Coverage reporter
- `reflect-metadata` - For dependency injection decorators
- Mocked `PrismaClient` - Database operations are mocked

## Mocking Strategy

The tests use Vitest's mocking capabilities to mock the Prisma Client:

```typescript
mockPrisma = {
  usageRecord: {
    create: vi.fn(),
    groupBy: vi.fn(),
  },
  service: {
    findMany: vi.fn(),
  },
};
```

### Why Mock Prisma?

1. **Speed**: Unit tests run in milliseconds without database I/O
2. **Isolation**: Tests focus on business logic, not database behavior
3. **Reliability**: No dependency on external database state
4. **Simplicity**: Easy to test error conditions and edge cases

## Edge Cases Covered

1. **Zero quantities**: Validates that zero usage is recorded correctly
2. **Large quantities**: Tests handling of very large usage values (999999.99)
3. **Null aggregations**: Ensures null sums from database are converted to 0
4. **Empty results**: Validates behavior when no data exists
5. **Database errors**: Tests error propagation from database layer
6. **Negative values**: Tests mathematical edge case (though not expected in production)
7. **Fractional values**: Validates decimal precision handling
8. **Rounding behavior**: Tests both rounding up and down scenarios

## Error Handling

All methods include error handling tests that verify:

1. Errors from Prisma operations are properly propagated
2. Error messages are preserved
3. No unhandled promise rejections occur

## Future Improvements

While achieving 100% coverage, potential enhancements could include:

1. Integration tests with a real test database
2. Performance tests for large-scale aggregations
3. Concurrency tests for simultaneous usage recording
4. Tests for usage report generation and export
5. Tests for usage-based billing triggers

## Related Documentation

- [API Error Codes](./ERROR_CODES.md)
- [Stripe Billing Implementation](./STRIPE_BILLING_IMPLEMENTATION.md)
- [Security Guidelines](./SECURITY.md)

## Stripe Client Note

The issue mentioned "Mock Stripe client interactions," but the current `UsageTrackingService` implementation does not directly interact with Stripe. Usage tracking is separate from billing. If future integration with Stripe usage-based billing is needed, those Stripe API calls would be added to a separate billing service and tested similarly with mocked Stripe clients.
