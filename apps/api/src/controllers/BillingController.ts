import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { BillingService, SubscriptionService, UsageTrackingService } from '../services';
import { env } from '../config/env';

/**
 * BillingController
 * Thin controller layer for billing routes
 * Delegates business logic to BillingService, SubscriptionService, and UsageTrackingService
 */
@injectable()
export class BillingController {
  constructor(
    @inject(Symbol.for('BillingService'))
    private billingService: BillingService,
    @inject(Symbol.for('SubscriptionService'))
    private subscriptionService: SubscriptionService,
    @inject(Symbol.for('UsageTrackingService'))
    private usageTrackingService: UsageTrackingService,
  ) {}

  /**
   * GET /billing/subscription
   * Get current subscription
   */
  async getSubscription(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const subscription = await this.subscriptionService.getSubscription({ userId });

      if (!subscription) {
        return reply.status(404).send({ error: 'No subscription found' });
      }

      return subscription;
    } catch (error) {
      request.log.error({ error }, 'Failed to get subscription');
      return reply.status(500).send({ error: 'Failed to get subscription' });
    }
  }

  /**
   * POST /billing/checkout
   * Create checkout session
   */
  async createCheckoutSession(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      const { priceId, plan } = request.body as { priceId: string; plan: string };

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!priceId || !plan) {
        return reply.status(400).send({ error: 'priceId and plan are required' });
      }

      // Get or create customer
      const user = await request.server.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const customerId = await this.billingService.getOrCreateCustomer({
        userId,
        email: `${user.username}@noreply.${env.PLATFORM_DOMAIN}`, // TODO: Add email field to User model
        name: user.username,
      });

      // Create checkout session
      const session = await this.billingService.createCheckoutSession({
        customerId,
        priceId,
        successUrl: `${env.APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${env.APP_BASE_URL}/billing`,
      });

      return { sessionId: session.sessionId, url: session.url };
    } catch (error) {
      request.log.error({ error }, 'Failed to create checkout session');
      return reply.status(500).send({ error: 'Failed to create checkout session' });
    }
  }

  /**
   * POST /billing/portal
   * Create portal session
   */
  async createPortalSession(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const subscription = await this.subscriptionService.getSubscription({ userId });

      if (!subscription) {
        return reply.status(404).send({ error: 'No subscription found' });
      }

      const session = await this.billingService.createPortalSession({
        customerId: subscription.stripeCustomerId,
        returnUrl: `${env.APP_BASE_URL}/billing`,
      });

      return { url: session.url };
    } catch (error) {
      request.log.error({ error }, 'Failed to create portal session');
      return reply.status(500).send({ error: 'Failed to create portal session' });
    }
  }

  /**
   * GET /billing/invoices
   * Get invoices
   */
  async getInvoices(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const subscription = await this.subscriptionService.getSubscription({ userId });

      if (!subscription) {
        return reply.status(404).send({ error: 'No subscription found' });
      }

      const invoices = await this.billingService.getInvoices(subscription.stripeCustomerId);

      return { invoices };
    } catch (error) {
      request.log.error({ error }, 'Failed to get invoices');
      return reply.status(500).send({ error: 'Failed to get invoices' });
    }
  }

  /**
   * GET /billing/usage
   * Get usage for current period
   */
  async getUsage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Get current billing period from subscription
      const subscription = await this.subscriptionService.getSubscription({ userId });

      if (!subscription) {
        return reply.status(404).send({ error: 'No subscription found' });
      }

      const usage = await this.usageTrackingService.getAggregatedUsage({
        userId,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      });

      return {
        usage,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      };
    } catch (error) {
      request.log.error({ error }, 'Failed to get usage');
      return reply.status(500).send({ error: 'Failed to get usage' });
    }
  }
}
