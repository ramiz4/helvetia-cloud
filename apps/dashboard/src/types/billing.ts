/**
 * Billing types for subscription management
 */

export type SubscriptionPlan = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';
export type UsageMetricType = 'COMPUTE_HOURS' | 'MEMORY_GB_HOURS' | 'BANDWIDTH_GB' | 'STORAGE_GB';

/**
 * Subscription details
 */
export interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

/**
 * Invoice details
 */
export interface Invoice {
  id: string;
  number: string;
  status: string;
  created: number;
  amount_due: number;
  amount_paid: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

/**
 * Usage metric
 */
export interface UsageMetric {
  metric: UsageMetricType;
  quantity: number;
  cost: number;
}

/**
 * Usage response
 */
export interface Usage {
  usage: UsageMetric[];
  periodStart: string;
  periodEnd: string;
}

/**
 * Checkout session response
 */
export interface CheckoutSession {
  sessionId: string;
  url: string;
}

/**
 * Portal session response
 */
export interface PortalSession {
  url: string;
}

/**
 * Plan details for display
 */
export interface PlanDetails {
  name: SubscriptionPlan;
  displayName: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  priceId: string;
  highlighted?: boolean;
}
