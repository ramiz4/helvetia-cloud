import { SubscriptionPlan, SubscriptionStatus } from 'database';
import type { FastifyReply, FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import { inject, injectable } from 'tsyringe';
import { env } from '../config/env';
import { getStripeClient } from '../config/stripe';
import { SubscriptionService } from '../services';

/**
 * StripeWebhookController
 * Handles Stripe webhook events for subscription management
 */
@injectable()
export class StripeWebhookController {
  private stripe: Stripe | null;

  constructor(
    @inject(Symbol.for('SubscriptionService'))
    private subscriptionService: SubscriptionService,
  ) {
    this.stripe = getStripeClient();
  }

  /**
   * POST /webhooks/stripe
   * Handle Stripe webhook events
   */
  async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    if (!this.stripe) {
      request.log.error('Stripe is not configured');
      return reply.status(500).send({ error: 'Stripe is not configured' });
    }

    if (!env.STRIPE_WEBHOOK_SECRET) {
      request.log.error('Stripe webhook secret is not configured');
      return reply.status(500).send({ error: 'Stripe webhook secret is not configured' });
    }

    const sig = request.headers['stripe-signature'];

    if (!sig || typeof sig !== 'string') {
      request.log.error('Missing stripe-signature header');
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    // Get raw body from request
    const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      request.log.error('Missing raw body for webhook verification');
      return reply.status(400).send({ error: 'Missing raw body' });
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      request.log.error({ err }, 'Webhook signature verification failed');
      return reply.status(400).send({ error: 'Webhook signature verification failed' });
    }

    // Check for malformed JSON from custom parser
    const body = request.body as unknown;
    if (
      body &&
      typeof body === 'object' &&
      '_isMalformed' in body &&
      (body as { _isMalformed: boolean })._isMalformed
    ) {
      request.log.error({ error: (body as { _error?: string })._error }, 'Malformed webhook JSON');
      return reply.status(400).send({ error: 'Malformed webhook JSON' });
    }

    try {
      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription, request);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription, request);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription, request);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice, request);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, request);
          break;

        default:
          request.log.info({ eventType: event.type }, 'Unhandled webhook event type');
      }

      return reply.status(200).send({ received: true });
    } catch (error) {
      request.log.error({ error, eventType: event.type }, 'Error handling webhook');
      return reply.status(500).send({ error: 'Error handling webhook' });
    }
  }

  /**
   * Handle subscription created event
   */
  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
    request: FastifyRequest,
  ) {
    request.log.info({ subscriptionId: subscription.id }, 'Subscription created');

    const plan = this.mapStripePlanToSubscriptionPlan(subscription, request);
    const status = this.mapStripeStatus(subscription.status);

    // Extract user/org ID from customer metadata
    const customer = subscription.customer as string;
    const customerDetails = await this.stripe?.customers.retrieve(customer);

    if (!customerDetails || customerDetails.deleted) {
      request.log.error(
        { customer, subscriptionId: subscription.id },
        'Customer not found or deleted for subscription',
      );
      throw new Error(
        `Stripe customer "${customer}" not found or deleted for subscription "${subscription.id}"`,
      );
    }

    const metadata = customerDetails.metadata;
    const userId = metadata.userId || undefined;
    const organizationId = metadata.organizationId || undefined;

    await this.subscriptionService.upsertSubscription({
      userId,
      organizationId,
      stripeCustomerId: customer,
      stripeSubscriptionId: subscription.id,
      plan,
      status,
      currentPeriodStart: new Date(subscription.items.data[0].current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
    });
  }

  /**
   * Handle subscription updated event
   */
  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
    request: FastifyRequest,
  ) {
    request.log.info({ subscriptionId: subscription.id }, 'Subscription updated');

    const status = this.mapStripeStatus(subscription.status);

    await this.subscriptionService.updateSubscriptionStatus({
      stripeSubscriptionId: subscription.id,
      status,
      currentPeriodStart: new Date(subscription.items.data[0].current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
    });
  }

  /**
   * Handle subscription deleted event
   */
  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
    request: FastifyRequest,
  ) {
    request.log.info({ subscriptionId: subscription.id }, 'Subscription deleted');

    await this.subscriptionService.updateSubscriptionStatus({
      stripeSubscriptionId: subscription.id,
      status: 'CANCELED',
    });
  }

  /**
   * Handle invoice paid event
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice, request: FastifyRequest) {
    request.log.info({ invoiceId: invoice.id }, 'Invoice paid');

    // Get subscription ID - handle different possible API versions
    let subscriptionId: string | undefined;

    // Try standard property first
    if ('subscription' in invoice) {
      subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : (invoice.subscription as any)?.id;
    }

    if (subscriptionId) {
      const subscription = await this.stripe?.subscriptions.retrieve(subscriptionId);

      if (subscription && subscription.status === 'active') {
        await this.subscriptionService.updateSubscriptionStatus({
          stripeSubscriptionId: subscriptionId,
          status: 'ACTIVE',
        });
      }
    }
  }

  /**
   * Handle invoice payment failed event
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice, request: FastifyRequest) {
    request.log.info({ invoiceId: invoice.id }, 'Invoice payment failed');

    // Mark subscription as past due
    // Mark subscription as past due
    interface InvoiceWithSubscriptionId extends Stripe.Invoice {
      subscription?: string | Stripe.Subscription | null;
      subscription_id?: string | null;
      subscription_details?: {
        subscription?: string | Stripe.Subscription | null;
      } | null;
    }

    const inv = invoice as InvoiceWithSubscriptionId;
    const subscriptionId =
      inv.subscription_id ||
      (typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id) ||
      (typeof inv.subscription_details?.subscription === 'string'
        ? inv.subscription_details.subscription
        : inv.subscription_details?.subscription?.id);

    if (subscriptionId) {
      await this.subscriptionService.updateSubscriptionStatus({
        stripeSubscriptionId: subscriptionId,
        status: 'PAST_DUE',
      });
    }
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

  /**
   * Map Stripe subscription to our plan enum
   * This is a simplified version - in production, you'd check price IDs
   */
  private mapStripePlanToSubscriptionPlan(
    subscription: Stripe.Subscription,
    request: FastifyRequest,
  ): SubscriptionPlan {
    // Get the first price from subscription items
    const priceId = subscription.items.data[0]?.price?.id;

    // Map price IDs to plans (using env variables)
    if (priceId === env.STRIPE_PRICE_ID_STARTER) {
      return 'STARTER';
    } else if (priceId === env.STRIPE_PRICE_ID_PRO) {
      return 'PRO';
    } else if (priceId === env.STRIPE_PRICE_ID_ENTERPRISE) {
      return 'ENTERPRISE';
    }

    // Default to free if we can't determine
    request.log.warn(
      { subscriptionId: subscription.id, priceId },
      'Unable to map Stripe price ID to subscription plan, defaulting to FREE',
    );
    return 'FREE';
  }
}
