# Billing System Documentation

## Overview

The Helvetia Cloud billing system is a comprehensive subscription management solution integrated with Stripe. It enables users to subscribe to different tiers of service, manages recurring billing, and enforces resource limits based on the active plan.

## Architecture

The system is composed of three main layers:

1.  **Frontend (Dashboard)**: A React/Next.js interface for managing subscriptions, viewing usage, and accessing invoices.
2.  **Backend (API)**: A Node.js/Fastify service that handles subscription logic, enforces limits via middleware, and processes Stripe webhooks.
3.  **External (Stripe)**: Handles payment processing, subscription lifecycle management, and invoicing.

---

## 1. Billing UI & Frontend Implementation

### Components (`apps/dashboard/src/components/billing/`)

- **`CurrentPlanCard`**: Displays the user's active subscription, status (Active, Past Due, Canceled), and renewal dates. Provides access to the Stripe Customer Portal.
- **`PlanCard`**: Reusable component for displaying plan tiers (Free, Starter, Pro, Enterprise). Handles the checkout flow initiation.
- **`UsageMetrics`**: Visualizes resource consumption (CPU, Memory, Services, etc.) against plan limits.
- **`InvoiceList`**: Lists past invoices with status indicators and PDF download links.

### Hooks (`apps/dashboard/src/hooks/`)

- **`useBilling`**: A set of React Query hooks (`useSubscription`, `useUsage`, `useInvoices`) that interface with the backend API.
- **`useCheckout`**: Manages the redirection to Stripe Checkout.
- **`usePortal`**: Manages the redirection to the Stripe Customer Portal.

### Design System

The billing UI utilizes a "Glassmorphism" aesthetic consistent with the rest of the application:

- **Backgrounds**: `bg-slate-900/40` with `backdrop-blur-xl`.
- **Borders**: Subtle `border-white/10` with hover effects `border-indigo-500/30`.
- **Typography**: `Inter` font, tabular numbers for metrics.
- **Responsiveness**: Mobile-first grid layouts (`gap-4` to `gap-8`).

---

## 2. Backend Middleware & Enforcement

### Subscription Middleware (`apps/api/src/middleware/subscription.middleware.ts`)

The core of the enforcement logic resides in the subscription middleware. It runs before resource creation endpoints to ensure compliance with plan limits.

#### Enforcement Logic

1.  **Resource Limits**: Checks if creating a new resource (Service, Volume, etc.) would exceed the user's plan limits.
    - _Example_: Creating a 6th service on a Starter plan (limit 5) throws a `ForbiddenError`.
2.  **Grace Period**: Implements a 7-day grace period for `PAST_DUE` subscriptions.
    - _Logic_: If `now < periodEnd + 7 days`, access is allowed.
3.  **Status Blocks**:
    - `CANCELED` or `UNPAID` subscriptions are blocked from creating new resources.
    - `ACTIVE` subscriptions are always allowed (within limits).

### Stripe Webhooks (`apps/api/src/controllers/StripeWebhookController.ts`)

The system listens for Stripe events to keep local state in sync:

- `customer.subscription.updated`: Syncs status, plan changes, and renewal dates.
- `customer.subscription.deleted`: Marks local subscription as CANCELED.
- `invoice.payment_failed`: Updates status to PAST_DUE.

---

## 3. Testing Infrastructure

The billing system is covered by a comprehensive suite of unit and integration tests.

### Middleware Tests (`apps/api/src/middleware/subscription.middleware.test.ts`)

- **Coverage**: 29 tests.
- **Scenarios**:
  - Active/Past Due/Canceled access control.
  - Exact boundary testing for Grace Periods (Day 0 vs Day 7).
  - Resource limit enforcement (Service count, CPU, Memory).
  - Plan upgrades/downgrades.

### Webhook Tests (`apps/api/src/middleware/subscription-webhooks.test.ts`)

- **Coverage**: 15 tests.
- **Scenarios**:
  - Status transitions (Active -> Past Due -> Active).
  - Plan changes (Starter -> Pro).
  - Handling of non-existent subscriptions.
  - Idempotency and rapid event handling.

### UI Integration Tests (`apps/dashboard/src/components/billing/*.test.tsx`)

- **Coverage**: 32 tests.
- **Scenarios**:
  - Rendering of correct plan details and statuses.
  - Conditional rendering of actions (e.g., "Upgrade" vs "Manage").
  - Error handling and loading states.
  - Accessibility compliance of billing components.

## Running Tests

```bash
# Backend Tests
cd apps/api
pnpm test -- subscription

# Frontend Tests
cd apps/dashboard
pnpm test -- billing
```

## Configuration

### Environment Variables

- `STRIPE_SECRET_KEY`: Backend secret for API access.
- `STRIPE_WEBHOOK_SECRET`: For verifying webhook signatures.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Frontend key.
- `NEXT_PUBLIC_STRIPE_PRICE_ID_*`: Price IDs for different tiers.

### Plan Limits (`packages/shared/src/config/plans.ts`)

Defines the quotas for each tier (Free, Starter, Pro, Enterprise) regarding CPU, RAM, Storage, and Service counts.
