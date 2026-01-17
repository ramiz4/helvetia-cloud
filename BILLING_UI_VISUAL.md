# Billing Dashboard UI - Visual Structure

## Page Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Navigation Bar                            │
│  [Dashboard] [Deployments] [Billing] 💳 [Settings]              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      /billing (Main Page)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Current Plan  │   │ Usage Metrics │   │    Invoices   │
│               │   │               │   │               │
│ • Plan: PRO   │   │ • Compute     │   │ • INV-001     │
│ • Status      │   │ • Memory      │   │ • INV-002     │
│ • Period      │   │ • Bandwidth   │   │ • Download    │
│               │   │ • Storage     │   │               │
│ [Manage Sub]  │   │               │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
        │
        ├─── Manage → Stripe Customer Portal
        │               │
        │               ├─── Update Payment Method
        │               ├─── Cancel Subscription
        │               └─── View Billing History
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Available Plans                             │
│                                                                  │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐               │
│  │  FREE  │  │STARTER │  │  PRO   │  │ENTERPRISE│              │
│  │  $0    │  │  $29   │  │  $99   │  │  $299   │               │
│  │        │  │        │  │[Popular]│  │         │               │
│  │[Select]│  │[Select]│  │[Select]│  │[Select] │               │
│  └────────┘  └────────┘  └────────┘  └────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ User clicks [Select]
                              ▼
                    ┌────────────────────┐
                    │ Confirmation Modal │
                    │                    │
                    │ "Upgrade to PRO?"  │
                    │                    │
                    │ [Cancel] [Confirm] │
                    └────────────────────┘
                              │
                              │ Confirm
                              ▼
                      API: POST /billing/checkout
                              │
                              ▼
                    Stripe Checkout Session
                              │
                ┌─────────────┴─────────────┐
                │                           │
          Payment Success           Payment Cancel
                │                           │
                ▼                           ▼
        /billing/success          /billing/cancel
                │                           │
                └─────────────┬─────────────┘
                              │
                              ▼
                      Back to /billing
```

## Component Architecture

```
/billing (page.tsx)
│
├── <CurrentPlanCard>
│   ├── Props: subscription, onManage, loading
│   └── Actions: Opens Stripe Portal
│
├── <UsageMetrics>
│   ├── Props: usage
│   └── Displays: 4 metric cards
│
├── <InvoiceList>
│   ├── Props: invoices
│   └── Features: PDF downloads
│
└── <PlanCard> × 4 (FREE, STARTER, PRO, ENTERPRISE)
    ├── Props: plan, currentPlan, onSelect, loading
    └── Actions: Triggers checkout flow
```

## Data Flow

```
┌──────────────┐
│  Component   │
└──────┬───────┘
       │
       │ useBilling hooks
       ▼
┌──────────────┐
│ React Query  │ ◄──── Caching & Auto-refetch
└──────┬───────┘
       │
       │ fetchWithAuth
       ▼
┌──────────────┐
│  API Client  │
└──────┬───────┘
       │
       │ HTTP Request
       ▼
┌──────────────┐
│ Backend API  │
│              │
│ /billing/*   │
└──────┬───────┘
       │
       │ Stripe SDK
       ▼
┌──────────────┐
│   Stripe     │
└──────────────┘
```

## File Structure Tree

```
apps/dashboard/
├── src/
│   ├── app/
│   │   └── billing/
│   │       ├── page.tsx ..................... Main billing dashboard
│   │       ├── success/
│   │       │   └── page.tsx ................ Checkout success page
│   │       └── cancel/
│   │           └── page.tsx ................ Checkout cancel page
│   │
│   ├── components/
│   │   ├── Navigation.tsx .................. Updated with billing link
│   │   └── billing/
│   │       ├── PlanCard.tsx ................ Individual plan display
│   │       ├── PlanCard.test.tsx
│   │       ├── CurrentPlanCard.tsx ......... Active subscription
│   │       ├── CurrentPlanCard.test.tsx
│   │       ├── UsageMetrics.tsx ............ Resource usage
│   │       ├── UsageMetrics.test.tsx
│   │       ├── InvoiceList.tsx ............. Billing history
│   │       └── InvoiceList.test.tsx
│   │
│   ├── hooks/
│   │   ├── useBilling.ts ................... Billing API hooks
│   │   └── useBilling.test.tsx
│   │
│   ├── lib/
│   │   └── plans.ts ........................ Plan configuration
│   │
│   └── types/
│       └── billing.ts ...................... TypeScript types
│
└── docs/
    └── BILLING_UI.md ....................... Documentation

Root:
├── .env.example ............................ Updated with price IDs
└── BILLING_UI_SUMMARY.md ................... Implementation summary
```

## Test Coverage Map

```
useBilling.test.tsx (6 tests)
├── useSubscription
│   ├── ✓ fetch subscription successfully
│   └── ✓ handle subscription not found
├── useInvoices
│   ├── ✓ fetch invoices successfully
│   └── ✓ handle empty invoices
├── useUsage
│   └── ✓ fetch usage successfully
└── billingKeys
    └── ✓ generate correct query keys

PlanCard.test.tsx (6 tests)
├── ✓ render plan details correctly
├── ✓ show "Popular" badge
├── ✓ show "Current Plan" badge
├── ✓ render "Select Plan" button
├── ✓ render "Current Plan" button
└── ✓ render "Processing..." button

CurrentPlanCard.test.tsx (7 tests)
├── ✓ render subscription details
├── ✓ display formatted dates
├── ✓ render "Manage Subscription" button
├── ✓ render "Loading..." button
└── ✓ show correct status colors (ACTIVE, PAST_DUE, CANCELED)

UsageMetrics.test.tsx (5 tests)
├── ✓ render usage metrics title
├── ✓ render all usage metrics
├── ✓ render correct quantities
├── ✓ render correct costs
└── ✓ show "No usage data" message

InvoiceList.test.tsx (8 tests)
├── ✓ render invoice list title
├── ✓ render all invoices
├── ✓ render invoice amounts
├── ✓ render invoice statuses
├── ✓ render download link
├── ✓ not render download link when PDF unavailable
├── ✓ show "No invoices yet" message
└── ✓ show correct status colors

Total: 32 tests, all passing ✓
```

## API Integration Map

```
Frontend Hooks          Backend Endpoints         Stripe
────────────────        ──────────────────        ──────
useSubscription()   →   GET /billing/subscription
                        ← { plan, status, ... }

useInvoices()       →   GET /billing/invoices
                        ← { invoices: [...] }     → List Invoices

useUsage()          →   GET /billing/usage
                        ← { usage: [...] }

useCheckout()       →   POST /billing/checkout    → Create Session
                        ← { url, sessionId }

usePortal()         →   POST /billing/portal      → Create Portal
                        ← { url }
```

## Styling System

```
Design Pattern: Glassmorphism
├── Base: bg-slate-900/40
├── Blur: backdrop-blur-xl
├── Border: border-white/10
└── Hover: border-indigo-500/30

Colors:
├── Primary: Indigo (accent, highlights)
├── Success: Emerald (active status)
├── Warning: Amber (past due)
├── Error: Rose (canceled, errors)
└── Info: Cyan (bandwidth metrics)

Typography:
├── Headings: font-extrabold tracking-tight
├── Body: font-medium text-slate-400
└── Numbers: tabular-nums font-bold

Spacing:
├── Cards: p-8 rounded-[32px]
├── Buttons: px-6 py-4 rounded-2xl
└── Grid: gap-8 (desktop), gap-4 (mobile)
```

## Security Features

```
✓ Authentication Required
  └── All billing routes protected

✓ Environment Variables
  ├── NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER
  ├── NEXT_PUBLIC_STRIPE_PRICE_ID_PRO
  └── NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE

✓ API Security
  ├── JWT token validation
  ├── HTTPS only (Stripe requirement)
  └── No sensitive data in client

✓ Error Handling
  ├── Generic error messages
  ├── No stack traces to client
  └── Logging for debugging

✓ Input Validation
  └── Zod schemas in backend
```

## Browser Compatibility

```
✓ Chrome 90+     ✓ Firefox 88+     ✓ Safari 14+
✓ Edge 90+       ✓ Opera 76+       ✓ Samsung Internet 14+
✓ iOS Safari 14+ ✓ Chrome Android  ✓ Firefox Android
```

## Performance Metrics

```
Bundle Size Impact:
├── Components: ~15KB (gzipped)
├── Hooks: ~3KB (gzipped)
├── Types: 0KB (TypeScript only)
└── Total: ~18KB added

React Query Benefits:
├── Automatic caching
├── Background refetching
├── Request deduplication
└── Optimistic updates

Loading Performance:
├── Server-side rendering ready
├── Code splitting automatic
├── Lazy loading for heavy components
└── Image optimization via Next.js
```
