# Stripe Billing Integration - Implementation Summary

## Overview

This document summarizes the Stripe billing integration implementation for Helvetia Cloud. The integration provides subscription management, usage-based pricing, and payment processing through Stripe.

## Completed Features

### Phase 1: Database Schema & Environment Setup ✅

**Database Models Added:**

- `Subscription` - Stores subscription information for users/organizations
  - Fields: id, userId, organizationId, stripeCustomerId, stripeSubscriptionId, plan, status, currentPeriodStart, currentPeriodEnd
  - Indexes on userId, organizationId, stripeCustomerId, status
- `UsageRecord` - Tracks resource usage for billing
  - Fields: id, serviceId, metric, quantity, timestamp, periodStart, periodEnd
  - Indexes on serviceId/period range, timestamp, metric
- Enums: `SubscriptionPlan` (FREE, STARTER, PRO, ENTERPRISE)
- Enums: `SubscriptionStatus` (ACTIVE, PAST_DUE, CANCELED, UNPAID)
- Enums: `UsageMetric` (COMPUTE_HOURS, MEMORY_GB_HOURS, BANDWIDTH_GB, STORAGE_GB)

**Environment Variables:**

- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature secret
- `STRIPE_PRICE_ID_STARTER` - Price ID for Starter plan
- `STRIPE_PRICE_ID_PRO` - Price ID for Pro plan
- `STRIPE_PRICE_ID_ENTERPRISE` - Price ID for Enterprise plan
- `STRIPE_PRICE_ID_COMPUTE_HOURS` - Price ID for compute hours metering
- `STRIPE_PRICE_ID_MEMORY_GB_HOURS` - Price ID for memory usage metering
- `STRIPE_PRICE_ID_BANDWIDTH_GB` - Price ID for bandwidth metering
- `STRIPE_PRICE_ID_STORAGE_GB` - Price ID for storage metering

**Dependencies:**

- `stripe@^20.2.0` - Official Stripe Node.js SDK

### Phase 2: Backend - Core Stripe Integration ✅

**Services Implemented:**

1. **BillingService** (`apps/api/src/services/BillingService.ts`)
   - `getOrCreateCustomer()` - Create or retrieve Stripe customer
   - `createSubscription()` - Create new subscription
   - `updateSubscription()` - Update existing subscription (plan changes)
   - `cancelSubscription()` - Cancel subscription
   - `getSubscription()` - Retrieve subscription from Stripe
   - `createCheckoutSession()` - Create Stripe Checkout session
   - `createPortalSession()` - Create Stripe Customer Portal session
   - `getInvoices()` - Retrieve customer invoices
   - `reportUsage()` - Report metered usage to Stripe

2. **SubscriptionService** (`apps/api/src/services/SubscriptionService.ts`)
   - `getSubscription()` - Get subscription from database
   - `upsertSubscription()` - Create or update subscription
   - `updateSubscriptionStatus()` - Update subscription status
   - `hasActiveSubscription()` - Check if subscription is active
   - `getResourceLimits()` - Get resource limits for plan tier

3. **UsageTrackingService** (`apps/api/src/services/UsageTrackingService.ts`)
   - `recordUsage()` - Record usage metric
   - `getServiceUsage()` - Get usage for specific service
   - `getAggregatedUsage()` - Get aggregated usage for user/org
   - `calculateCost()` - Calculate cost for usage

**Resource Limits per Plan:**

```typescript
FREE: {
  maxServices: 1,
  maxMemoryMB: 512,
  maxCPUCores: 0.5,
  maxBandwidthGB: 10,
  maxStorageGB: 5,
}
STARTER: {
  maxServices: 5,
  maxMemoryMB: 2048,
  maxCPUCores: 2,
  maxBandwidthGB: 100,
  maxStorageGB: 50,
}
PRO: {
  maxServices: 20,
  maxMemoryMB: 8192,
  maxCPUCores: 8,
  maxBandwidthGB: 500,
  maxStorageGB: 200,
}
ENTERPRISE: {
  maxServices: -1, // Unlimited
  maxMemoryMB: -1,
  maxCPUCores: -1,
  maxBandwidthGB: -1,
  maxStorageGB: -1,
}
```

**Pricing Model:**

```typescript
COMPUTE_HOURS: $0.01 per hour
MEMORY_GB_HOURS: $0.005 per GB-hour
BANDWIDTH_GB: $0.12 per GB
STORAGE_GB: $0.023 per GB per month
```

**Controllers Implemented:**

1. **BillingController** (`apps/api/src/controllers/BillingController.ts`)
   - `GET /billing/subscription` - Get current subscription
   - `POST /billing/checkout` - Create checkout session
   - `POST /billing/portal` - Create portal session
   - `GET /billing/invoices` - Get invoices
   - `GET /billing/usage` - Get usage for current period

2. **StripeWebhookController** (`apps/api/src/controllers/StripeWebhookController.ts`)
   - `POST /webhooks/stripe` - Handle Stripe webhook events
   - Handles: subscription.created, subscription.updated, subscription.deleted
   - Handles: invoice.paid, invoice.payment_failed
   - Verifies webhook signatures for security

**API Routes:**

- `/api/v1/billing/*` - Billing management endpoints
- `/api/v1/webhooks/stripe` - Stripe webhook endpoint

**DI Registration:**
All services and controllers are registered in the DI container with singleton lifecycle.

## Remaining Implementation

### Phase 3: Backend - Usage Tracking System

**Tasks:**

1. Implement compute hours tracking for running services
   - Track when containers start/stop
   - Calculate runtime hours
   - Record to UsageRecord table

2. Implement memory usage tracking
   - Monitor container memory usage
   - Calculate GB-hours
   - Record usage metrics

3. Create background worker job for usage collection
   - Periodic job to collect metrics from running containers
   - Aggregate usage data
   - Report to Stripe for metered billing

4. Add usage aggregation and reporting endpoints
   - Historical usage reports
   - Usage forecasts based on trends

### Phase 4: Backend - Resource Enforcement

**Tasks:**

1. Add middleware to check subscription status
   - Verify active subscription before service operations
   - Block actions for unpaid/canceled subscriptions

2. Implement resource limit enforcement per tier
   - Check limits before service creation
   - Prevent exceeding tier quotas

3. Add grace period handling for past due subscriptions
   - 7-day grace period before service suspension
   - Warning notifications

4. Implement automatic service suspension
   - Stop services when subscription is canceled
   - Resume when payment is received

### Phase 5: Frontend - Billing Dashboard

**Tasks:**

1. Create billing page UI (`apps/dashboard/src/app/billing/page.tsx`)
   - Display current plan
   - Show subscription status
   - Usage metrics visualization

2. Add subscription plan selection component
   - Display available plans
   - Compare features
   - Initiate checkout flow

3. Add payment method management UI
   - Link to Stripe Customer Portal
   - Display current payment method
   - Update/add payment methods

4. Display current usage and costs
   - Real-time usage metrics
   - Cost breakdown by metric
   - Billing period information

5. Add invoice list and download
   - List past invoices
   - Download invoice PDFs
   - Payment history

6. Implement plan upgrade/downgrade flow
   - Smooth plan transitions
   - Proration handling
   - Confirmation dialogs

### Phase 6: Testing & Documentation

**Tasks:**

1. Add unit tests for BillingService
2. Add unit tests for SubscriptionService
3. Add unit tests for UsageTrackingService
4. Add integration tests for webhook handlers
5. Add tests for resource enforcement middleware
6. Document pricing structure
7. Update API documentation with billing endpoints
8. Create user guide for billing features
9. Add migration guide for existing users

## Setup Instructions

### Stripe Configuration

1. **Create Stripe Account**: Sign up at https://stripe.com

2. **Get API Keys**:
   - Go to Developers > API keys
   - Copy Secret key (starts with `sk_test_` for test mode)
   - Copy Publishable key (starts with `pk_test_` for test mode)

3. **Create Products and Prices**:
   - Go to Products
   - Create products for: Starter, Pro, Enterprise
   - Create metered prices for: Compute Hours, Memory GB Hours, Bandwidth GB, Storage GB
   - Copy all price IDs

4. **Configure Webhooks**:
   - Go to Developers > Webhooks
   - Add endpoint: `https://your-domain.com/api/v1/webhooks/stripe`
   - Select events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Copy webhook signing secret

5. **Update Environment Variables**:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID_STARTER=price_...
   STRIPE_PRICE_ID_PRO=price_...
   STRIPE_PRICE_ID_ENTERPRISE=price_...
   STRIPE_PRICE_ID_COMPUTE_HOURS=price_...
   STRIPE_PRICE_ID_MEMORY_GB_HOURS=price_...
   STRIPE_PRICE_ID_BANDWIDTH_GB=price_...
   STRIPE_PRICE_ID_STORAGE_GB=price_...
   ```

### Database Migration

Run the database migration to create billing tables:

```bash
pnpm migrate:dev
```

### Testing Webhooks Locally

Use Stripe CLI to forward webhooks to local development:

```bash
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
```

## Architecture Decisions

### Why Stripe?

- Industry-standard payment processor
- Comprehensive billing features (subscriptions, metering, invoices)
- Strong security and PCI compliance
- Excellent API and documentation
- Built-in Customer Portal for self-service

### Subscription Model

- User-level subscriptions: Individual users have their own subscriptions
- Organization-level subscriptions: Organizations can have shared subscriptions
- Free tier: Default for all new users
- Upgrade flow: Stripe Checkout for seamless payment
- Self-service: Customer Portal for management

### Usage Tracking

- Continuous monitoring of resource usage
- Periodic aggregation and reporting
- Metered billing sent to Stripe
- Transparent cost calculation

### Security

- Webhook signature verification
- Environment variable configuration
- No hardcoded secrets
- Stripe's PCI-compliant infrastructure

## Known Limitations

1. **Migration not yet run**: Database tables not created until migration is executed
2. **Frontend UI pending**: No user interface for billing features yet
3. **Usage tracking incomplete**: Automatic usage collection not implemented
4. **Resource enforcement missing**: No enforcement of subscription limits yet
5. **Testing needed**: Comprehensive test suite not yet added

## Next Steps

1. Run database migration when database is available
2. Implement usage tracking system (Phase 3)
3. Add resource enforcement middleware (Phase 4)
4. Build billing dashboard UI (Phase 5)
5. Add comprehensive tests (Phase 6)
6. Document pricing publicly
7. Conduct security audit
8. Perform PCI compliance verification
