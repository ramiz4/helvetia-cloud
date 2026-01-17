import type { SubscriptionStatus } from 'database';
import type Stripe from 'stripe';

/**
 * Billing service interface
 * Handles Stripe customer and subscription management
 */
export interface IBillingService {
  /**
   * Create or retrieve a Stripe customer for a user or organization
   */
  getOrCreateCustomer(params: {
    userId?: string;
    organizationId?: string;
    email: string;
    name: string;
  }): Promise<string>;

  /**
   * Create a subscription for a customer
   */
  createSubscription(params: {
    customerId: string;
    priceId: string;
    userId?: string;
    organizationId?: string;
  }): Promise<{
    subscriptionId: string;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }>;

  /**
   * Update an existing subscription
   */
  updateSubscription(params: { subscriptionId: string; priceId: string }): Promise<{
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }>;

  /**
   * Cancel a subscription
   */
  cancelSubscription(subscriptionId: string): Promise<void>;

  /**
   * Get subscription details from Stripe
   */
  getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null>;

  /**
   * Create a checkout session for subscription purchase
   */
  createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }>;

  /**
   * Create a portal session for managing subscription and payment methods
   */
  createPortalSession(params: { customerId: string; returnUrl: string }): Promise<{ url: string }>;

  /**
   * Get all invoices for a customer
   */
  getInvoices(customerId: string, limit?: number): Promise<Stripe.Invoice[]>;

  /**
   * Report usage for metered billing
   */
  reportUsage(params: {
    subscriptionItemId: string;
    quantity: number;
    timestamp?: number;
  }): Promise<void>;
}
