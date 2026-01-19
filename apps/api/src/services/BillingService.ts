import { PrismaClient, SubscriptionStatus } from 'database';
import Stripe from 'stripe';
import { inject, injectable } from 'tsyringe';
import { getStripeClient, isStripeConfigured } from '../config/stripe.js';
import { TOKENS } from '../di/tokens.js';
import type { IBillingService } from '../interfaces/index.js';

/**
 * BillingService
 * Handles Stripe customer and subscription management
 */
@injectable()
export class BillingService implements IBillingService {
  private stripe: Stripe | null;

  constructor(
    @inject(TOKENS.PrismaClient)
    private prisma: PrismaClient,
  ) {
    this.stripe = getStripeClient();
  }

  /**
   * Check if Stripe is available
   */
  private ensureStripeConfigured(): Stripe {
    if (!this.stripe || !isStripeConfigured()) {
      throw new Error('Stripe is not configured');
    }
    return this.stripe;
  }

  /**
   * Create or retrieve a Stripe customer for a user or organization
   */
  async getOrCreateCustomer(params: {
    userId?: string;
    organizationId?: string;
    email: string;
    name: string;
  }): Promise<string> {
    const stripe = this.ensureStripeConfigured();

    // Check if customer already exists in database
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: params.userId,
        organizationId: params.organizationId,
      },
    });

    if (existingSubscription) {
      return existingSubscription.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: {
        userId: params.userId || '',
        organizationId: params.organizationId || '',
      },
    });

    return customer.id;
  }

  /**
   * Create a subscription for a customer
   */
  async createSubscription(params: {
    customerId: string;
    priceId: string;
    userId?: string;
    organizationId?: string;
  }): Promise<{
    subscriptionId: string;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }> {
    const stripe = this.ensureStripeConfigured();

    const subscription = await stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    return {
      subscriptionId: subscription.id,
      status: this.mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.items.data[0].current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
    };
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(params: { subscriptionId: string; priceId: string }): Promise<{
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }> {
    const stripe = this.ensureStripeConfigured();

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);

    const subscriptionItem = subscription.items?.data?.[0];

    if (!subscriptionItem) {
      throw new Error('Subscription has no items to update');
    }

    // Update subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(params.subscriptionId, {
      items: [
        {
          id: subscriptionItem.id,
          price: params.priceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    return {
      status: this.mapStripeStatus(updatedSubscription.status),
      currentPeriodStart: new Date(updatedSubscription.items.data[0].current_period_start * 1000),
      currentPeriodEnd: new Date(updatedSubscription.items.data[0].current_period_end * 1000),
    };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    const stripe = this.ensureStripeConfigured();
    await stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Get subscription details from Stripe
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    const stripe = this.ensureStripeConfigured();
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a checkout session for subscription purchase
   */
  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }> {
    const stripe = this.ensureStripeConfigured();

    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      mode: 'subscription',
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Create a portal session for managing subscription and payment methods
   */
  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const stripe = this.ensureStripeConfigured();

    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });

    return { url: session.url };
  }

  /**
   * Get all invoices for a customer
   */
  async getInvoices(customerId: string, limit = 10): Promise<Stripe.Invoice[]> {
    const stripe = this.ensureStripeConfigured();

    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });

    return invoices.data;
  }

  /**
   * Report usage for metered billing
   */
  async reportUsage(params: {
    subscriptionItemId: string;
    quantity: number;
    timestamp?: number;
  }): Promise<void> {
    const stripe = this.ensureStripeConfigured();

    // Define an interface for SubscriptionItemsResource that includes createUsageRecord
    // This method is available at runtime but may be missing from some SDK types
    interface SubscriptionItemsResourceWithUsage extends Stripe.SubscriptionItemsResource {
      createUsageRecord(
        id: string,
        params: {
          quantity: number;
          timestamp?: number;
          action?: 'increment' | 'set';
        },
        options?: Stripe.RequestOptions,
      ): Promise<Stripe.Response<Record<string, unknown>>>;
    }

    const subscriptionItems = stripe.subscriptionItems as SubscriptionItemsResourceWithUsage;

    await subscriptionItems.createUsageRecord(params.subscriptionItemId, {
      quantity: Math.round(params.quantity),
      timestamp: params.timestamp || Math.floor(Date.now() / 1000),
      action: 'increment',
    });
  }

  /**
   * Map Stripe subscription status to our enum
   */
  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'ACTIVE';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
      case 'incomplete_expired':
        return 'CANCELED';
      case 'incomplete':
      case 'unpaid':
        return 'UNPAID';
      default:
        return 'UNPAID';
    }
  }
}
