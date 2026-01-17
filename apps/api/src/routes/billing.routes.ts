import type { FastifyPluginAsync } from 'fastify';
import { BillingController } from '../controllers/BillingController';
import { resolve, TOKENS } from '../di';
import { authenticate } from '../middleware/auth.middleware';

/**
 * Billing routes plugin
 * Handles subscription and billing-related endpoints
 */
export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  const billingController = resolve<BillingController>(TOKENS.BillingController);

  /**
   * GET /billing/subscription
   * Get current subscription
   */
  fastify.get(
    '/billing/subscription',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Billing'],
        summary: 'Get current subscription',
        description: 'Retrieve the current subscription details for the authenticated user',
        response: {
          200: {
            description: 'Subscription details',
            type: 'object',
            properties: {
              id: { type: 'string' },
              plan: { type: 'string', enum: ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] },
              status: { type: 'string', enum: ['ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID'] },
              stripeCustomerId: { type: 'string' },
              stripeSubscriptionId: { type: 'string', nullable: true },
              currentPeriodStart: { type: 'string', format: 'date-time' },
              currentPeriodEnd: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            description: 'No subscription found',
            type: 'object',
          },
        },
      },
    },
    (request, reply) => billingController.getSubscription(request, reply),
  );

  /**
   * POST /billing/checkout
   * Create checkout session
   */
  fastify.post(
    '/billing/checkout',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Billing'],
        summary: 'Create checkout session',
        description: 'Create a Stripe checkout session for purchasing a subscription',
        body: {
          type: 'object',
          required: ['priceId', 'plan'],
          properties: {
            priceId: {
              type: 'string',
              description: 'Stripe price ID',
            },
            plan: {
              type: 'string',
              enum: ['STARTER', 'PRO', 'ENTERPRISE'],
              description: 'Subscription plan',
            },
          },
        },
        response: {
          200: {
            description: 'Checkout session created',
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
      },
    },
    (request, reply) => billingController.createCheckoutSession(request, reply),
  );

  /**
   * POST /billing/portal
   * Create portal session
   */
  fastify.post(
    '/billing/portal',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Billing'],
        summary: 'Create billing portal session',
        description:
          'Create a Stripe customer portal session for managing subscription and payment methods',
        response: {
          200: {
            description: 'Portal session created',
            type: 'object',
            properties: {
              url: { type: 'string' },
            },
          },
        },
      },
    },
    (request, reply) => billingController.createPortalSession(request, reply),
  );

  /**
   * GET /billing/invoices
   * Get invoices
   */
  fastify.get(
    '/billing/invoices',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Billing'],
        summary: 'Get invoices',
        description: 'Retrieve all invoices for the authenticated user',
        response: {
          200: {
            description: 'List of invoices',
            type: 'object',
            properties: {
              invoices: {
                type: 'array',
                items: { type: 'object' },
              },
            },
          },
        },
      },
    },
    (request, reply) => billingController.getInvoices(request, reply),
  );

  /**
   * GET /billing/usage
   * Get usage for current period
   */
  fastify.get(
    '/billing/usage',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Billing'],
        summary: 'Get current usage',
        description: 'Retrieve resource usage for the current billing period',
        response: {
          200: {
            description: 'Usage data',
            type: 'object',
            properties: {
              usage: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    metric: {
                      type: 'string',
                      enum: ['COMPUTE_HOURS', 'MEMORY_GB_HOURS', 'BANDWIDTH_GB', 'STORAGE_GB'],
                    },
                    quantity: { type: 'number' },
                    cost: { type: 'number' },
                  },
                },
              },
              periodStart: { type: 'string', format: 'date-time' },
              periodEnd: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    (request, reply) => billingController.getUsage(request, reply),
  );
};
