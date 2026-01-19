import type { FastifyReply, FastifyRequest } from 'fastify';
import { inject, injectable } from 'tsyringe';
import { env } from '../config/env.js';
import { TOKENS } from '../di/tokens.js';
import type { IUserRepository } from '../interfaces/index.js';
import { BillingService } from '../services/BillingService.js';
import { SubscriptionService } from '../services/SubscriptionService.js';
import { UsageTrackingService } from '../services/UsageTrackingService.js';

/**
 * BillingController
 * Thin controller layer for billing routes
 * Delegates business logic to BillingService, SubscriptionService, and UsageTrackingService
 */
@injectable()
export class BillingController {
  constructor(
    @inject(TOKENS.BillingService)
    private billingService: BillingService,
    @inject(TOKENS.SubscriptionService)
    private subscriptionService: SubscriptionService,
    @inject(TOKENS.UsageTrackingService)
    private usageTrackingService: UsageTrackingService,
    @inject(TOKENS.UserRepository)
    private userRepository: IUserRepository,
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
      const user = await this.userRepository.findById(userId);

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

  /**
   * GET /billing/usage/history
   * Get usage history for custom date range
   */
  async getUsageHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const query = request.query as {
        periodStart?: string;
        periodEnd?: string;
        organizationId?: string;
      };

      // Validate and parse dates
      let periodEnd: Date;
      let periodStart: Date;

      if (query.periodEnd) {
        periodEnd = new Date(query.periodEnd);
        if (isNaN(periodEnd.getTime())) {
          return reply.status(400).send({ error: 'Invalid periodEnd date format' });
        }
      } else {
        periodEnd = new Date();
      }

      if (query.periodStart) {
        periodStart = new Date(query.periodStart);
        if (isNaN(periodStart.getTime())) {
          return reply.status(400).send({ error: 'Invalid periodStart date format' });
        }
      } else {
        // Default to 30 days ago
        periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Validate date range
      if (periodStart > periodEnd) {
        return reply.status(400).send({ error: 'periodStart must be before periodEnd' });
      }

      // Prevent future dates
      const now = new Date();
      if (periodEnd > now) {
        return reply.status(400).send({ error: 'periodEnd cannot be in the future' });
      }

      // Limit to 1 year maximum range
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      if (periodEnd.getTime() - periodStart.getTime() > oneYearMs) {
        return reply.status(400).send({ error: 'Date range cannot exceed 1 year' });
      }

      // Verify organization access if organizationId is provided
      if (query.organizationId) {
        const member = await this.userRepository.findById(userId).then(async (user) => {
          if (!user) return null;
          const prisma = await import('database').then((m) => m.prisma);
          return prisma.organizationMember.findFirst({
            where: {
              organizationId: query.organizationId,
              userId,
            },
          });
        });

        if (!member) {
          return reply.status(403).send({ error: 'Access denied to organization usage data' });
        }
      }

      const usage = await this.usageTrackingService.getAggregatedUsage({
        userId,
        organizationId: query.organizationId,
        periodStart,
        periodEnd,
      });

      return {
        usage,
        periodStart,
        periodEnd,
      };
    } catch (error) {
      request.log.error({ error }, 'Failed to get usage history');
      return reply.status(500).send({ error: 'Failed to get usage history' });
    }
  }

  /**
   * GET /billing/usage/service/:id
   * Get usage for a specific service
   */
  async getServiceUsage(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const params = request.params as { id: string };
      const query = request.query as {
        periodStart?: string;
        periodEnd?: string;
      };

      // Validate and parse dates
      let periodEnd: Date;
      let periodStart: Date;

      if (query.periodEnd) {
        periodEnd = new Date(query.periodEnd);
        if (isNaN(periodEnd.getTime())) {
          return reply.status(400).send({ error: 'Invalid periodEnd date format' });
        }
      } else {
        periodEnd = new Date();
      }

      if (query.periodStart) {
        periodStart = new Date(query.periodStart);
        if (isNaN(periodStart.getTime())) {
          return reply.status(400).send({ error: 'Invalid periodStart date format' });
        }
      } else {
        // Default to 30 days ago
        periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Validate date range
      if (periodStart > periodEnd) {
        return reply.status(400).send({ error: 'periodStart must be before periodEnd' });
      }

      // Prevent future dates
      const now = new Date();
      if (periodEnd > now) {
        return reply.status(400).send({ error: 'periodEnd cannot be in the future' });
      }

      // Limit to 1 year maximum range
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      if (periodEnd.getTime() - periodStart.getTime() > oneYearMs) {
        return reply.status(400).send({ error: 'Date range cannot exceed 1 year' });
      }

      // Verify service access (check both direct ownership and organization membership)
      const prisma = await import('database').then((m) => m.prisma);
      const service = await prisma.service.findUnique({
        where: { id: params.id },
        include: {
          environment: {
            include: {
              project: {
                include: {
                  organization: {
                    include: {
                      members: {
                        where: { userId },
                        select: { id: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!service) {
        return reply.status(404).send({ error: 'Service not found' });
      }

      // Check access: either direct owner or organization member
      const hasAccess =
        service.userId === userId ||
        (service.environment?.project.organization?.members &&
          service.environment.project.organization.members.length > 0);

      if (!hasAccess) {
        return reply.status(403).send({ error: 'Access denied to service usage data' });
      }

      const usage = await this.usageTrackingService.getServiceUsage({
        serviceId: params.id,
        periodStart,
        periodEnd,
      });

      return {
        usage,
        periodStart,
        periodEnd,
        serviceId: params.id,
        serviceName: service.name,
      };
    } catch (error) {
      request.log.error({ error }, 'Failed to get service usage');
      return reply.status(500).send({ error: 'Failed to get service usage' });
    }
  }
}
