# Billing Dashboard UI

This document provides an overview of the billing dashboard implementation for subscription management, usage monitoring, and payment handling.

## Overview

The billing dashboard provides a comprehensive interface for users to:

- View their current subscription plan and status
- Monitor resource usage metrics
- Access billing history and invoices
- Upgrade or downgrade subscription plans
- Manage payment methods via Stripe Customer Portal

## Architecture

### Directory Structure

```
apps/dashboard/src/
├── app/billing/              # Main billing pages
│   ├── page.tsx             # Billing dashboard overview
│   ├── success/             # Checkout success page
│   │   └── page.tsx
│   └── cancel/              # Checkout cancel page
│       └── page.tsx
├── components/billing/       # Reusable billing components
│   ├── PlanCard.tsx         # Individual plan card
│   ├── CurrentPlanCard.tsx  # Current subscription display
│   ├── UsageMetrics.tsx     # Usage metrics display
│   └── InvoiceList.tsx      # Invoice list with download
├── hooks/                    # Custom hooks
│   └── useBilling.ts        # Billing API hooks
├── lib/                      # Configuration and utilities
│   └── plans.ts             # Plan definitions
└── types/                    # TypeScript types
    └── billing.ts           # Billing-related types
```

### Components

#### PlanCard

Displays a subscription plan with:

- Plan name and pricing
- Feature list
- "Current Plan" badge (if applicable)
- "Popular" badge (if applicable)
- Select/upgrade button

#### CurrentPlanCard

Shows the user's active subscription:

- Plan name and status badge
- Current billing period dates
- "Manage Subscription" button (opens Stripe Customer Portal)

#### UsageMetrics

Displays resource usage for the current billing period:

- Compute hours
- Memory (GB·hours)
- Bandwidth (GB)
- Storage (GB)

Each metric shows quantity and cost.

#### InvoiceList

Lists all invoices with:

- Invoice number and status
- Invoice date
- Amount due/paid
- PDF download link

### API Integration

The billing dashboard integrates with the following backend APIs:

#### GET /billing/subscription

Retrieves the current subscription details.

**Response:**

```typescript
{
  id: string;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}
```

#### GET /billing/invoices

Retrieves all invoices for the user.

**Response:**

```typescript
{
  invoices: Invoice[]
}
```

#### GET /billing/usage

Retrieves usage metrics for the current billing period.

**Response:**

```typescript
{
  usage: UsageMetric[];
  periodStart: string;
  periodEnd: string;
}
```

#### POST /billing/checkout

Creates a Stripe Checkout session for plan upgrade.

**Request:**

```typescript
{
  priceId: string;
  plan: string;
}
```

**Response:**

```typescript
{
  sessionId: string;
  url: string;
}
```

#### POST /billing/portal

Creates a Stripe Customer Portal session for managing subscriptions and payment methods.

**Response:**

```typescript
{
  url: string;
}
```

### Hooks

#### useSubscription()

Fetches the current subscription. Returns React Query result with subscription data.

#### useInvoices()

Fetches all invoices. Returns React Query result with invoice list.

#### useUsage()

Fetches usage metrics. Returns React Query result with usage data.

#### useCheckout()

Mutation hook for creating checkout sessions.

#### usePortal()

Mutation hook for creating portal sessions.

## Environment Variables

The following environment variables must be configured:

```bash
# Public-facing Stripe price IDs (Frontend)
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE=price_xxx
```

## User Flows

### Upgrade Flow

1. User clicks "Select Plan" on a higher-tier plan card
2. Confirmation modal appears
3. User confirms upgrade
4. Checkout session is created via API
5. User is redirected to Stripe Checkout
6. After payment, user is redirected to `/billing/success`
7. Subscription is updated via webhook

### Manage Subscription Flow

1. User clicks "Manage Subscription" on CurrentPlanCard
2. Portal session is created via API
3. User is redirected to Stripe Customer Portal
4. User can update payment method, cancel subscription, or view billing history
5. User returns to billing dashboard

### Cancel Checkout Flow

1. User cancels during Stripe Checkout
2. User is redirected to `/billing/cancel`
3. User can return to billing dashboard to try again

## Testing

Comprehensive tests are included for all components and hooks:

- `useBilling.test.tsx`: Tests for all billing hooks
- `PlanCard.test.tsx`: Tests for PlanCard component
- `CurrentPlanCard.test.tsx`: Tests for CurrentPlanCard component
- `UsageMetrics.test.tsx`: Tests for UsageMetrics component
- `InvoiceList.test.tsx`: Tests for InvoiceList component

Run tests with:

```bash
pnpm --filter dashboard test src/hooks/useBilling.test.tsx src/components/billing
```

## Styling

The billing dashboard follows the existing design system:

- Glassmorphic cards with backdrop blur
- Indigo accent colors
- Responsive grid layouts
- Mobile-first approach
- Dark mode support via ThemeContext

## Future Enhancements

- Usage forecasting based on historical data
- Email notifications for billing events
- Usage alerts when approaching plan limits
- Multi-currency support
- Annual billing option with discount
