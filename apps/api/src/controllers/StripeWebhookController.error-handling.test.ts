import type { FastifyReply, FastifyRequest } from 'fastify';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockStripeCustomers,
  mockStripeSubscriptions,
  resetMockStripe,
} from '../test/mocks/stripe.mock';
import { StripeWebhookController } from './StripeWebhookController';

// Create test price IDs before vi.mock calls (hoisted)
const TEST_PRICE_ID_STARTER = 'price_test_starter_monthly';
const TEST_PRICE_ID_PRO = 'price_test_pro_monthly';
const TEST_PRICE_ID_ENTERPRISE = 'price_test_enterprise_monthly';

// Mock dependencies
const mockSubscriptionService = {
  upsertSubscription: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  getSubscription: vi.fn(),
  hasActiveSubscription: vi.fn(),
  getResourceLimits: vi.fn(),
};

const mockStripeWebhooks = {
  constructEvent: vi.fn(),
};

const mockStripeInstance = {
  customers: mockStripeCustomers as any,
  subscriptions: mockStripeSubscriptions as any,
  webhooks: mockStripeWebhooks as any,
};

vi.mock('../config/stripe', () => ({
  getStripeClient: () => mockStripeInstance,
}));

vi.mock('../config/env', () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_PRICE_ID_STARTER: 'price_test_starter_monthly',
    STRIPE_PRICE_ID_PRO: 'price_test_pro_monthly',
    STRIPE_PRICE_ID_ENTERPRISE: 'price_test_enterprise_monthly',
  },
}));

describe('StripeWebhookController - Error Handling', () => {
  let controller: StripeWebhookController;
  let mockRequest: Partial<FastifyRequest> & { rawBody?: Buffer };
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStripe();

    controller = new StripeWebhookController(mockSubscriptionService as any);

    mockRequest = {
      headers: {
        'stripe-signature': 'test-signature',
      },
      body: {},
      rawBody: Buffer.from('test-body'),
      log: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      } as any,
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Webhook Signature Verification Failures', () => {
    it('should reject webhook with missing signature header', async () => {
      mockRequest.headers = {};

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Missing stripe-signature header',
      });
      expect(mockRequest.log?.error).toHaveBeenCalledWith('Missing stripe-signature header');
    });

    it('should reject webhook with invalid signature', async () => {
      mockStripeWebhooks.constructEvent.mockImplementation(() => {
        throw Object.assign(new Error('Invalid signature'), {
          type: 'StripeSignatureVerificationError',
        });
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Webhook signature verification failed',
      });
      expect(mockRequest.log?.error).toHaveBeenCalled();
    });

    it('should reject webhook with expired signature', async () => {
      mockStripeWebhooks.constructEvent.mockImplementation(() => {
        throw Object.assign(new Error('Timestamp outside tolerance'), {
          type: 'StripeSignatureVerificationError',
          code: 'timestamp_too_old',
        });
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Webhook signature verification failed',
      });
    });

    it('should reject webhook with signature from different account', async () => {
      mockStripeWebhooks.constructEvent.mockImplementation(() => {
        throw Object.assign(new Error('No signatures found matching the expected signature'), {
          type: 'StripeSignatureVerificationError',
        });
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
    });

    it('should reject webhook with missing raw body', async () => {
      mockRequest.rawBody = undefined;

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Missing raw body',
      });
    });
  });

  describe('Malformed Webhook Payloads', () => {
    it('should reject malformed JSON payload', async () => {
      mockRequest.body = {
        _isMalformed: true,
        _error: 'Unexpected token in JSON',
      };

      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: { object: {} },
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Malformed webhook JSON',
      });
    });

    it('should handle webhook with missing event type', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: undefined,
        data: { object: {} },
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
    });

    it('should handle webhook with missing data object', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: undefined,
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Error handling webhook',
      });
    });

    it('should handle webhook with incomplete subscription data', async () => {
      const customer = await mockStripeCustomers.create({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-123' },
      });

      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test_123',
            customer: customer.id,
            status: 'active',
            items: { data: [] }, // Empty items array
          },
        },
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Event Handling Failures', () => {
    it('should handle database errors during subscription creation', async () => {
      const customer = await mockStripeCustomers.create({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-123' },
      });

      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test_123',
            customer: customer.id,
            status: 'active',
            items: {
              data: [
                {
                  price: { id: TEST_PRICE_ID_STARTER },
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                },
              ],
            },
          },
        },
      });

      mockSubscriptionService.upsertSubscription.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Error handling webhook',
      });
      expect(mockRequest.log?.error).toHaveBeenCalled();
    });

    it('should handle missing customer metadata during subscription creation', async () => {
      const customer = await mockStripeCustomers.create({
        email: 'test@example.com',
        name: 'Test User',
        metadata: {}, // No userId or organizationId
      });

      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test_123',
            customer: customer.id,
            status: 'active',
            items: {
              data: [
                {
                  price: { id: TEST_PRICE_ID_STARTER },
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                },
              ],
            },
          },
        },
      });

      // Ensure the mock resolves successfully
      mockSubscriptionService.upsertSubscription.mockResolvedValue(undefined as any);

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      // Should still process successfully with undefined userId/organizationId
      // The service should call upsertSubscription with undefined values
      expect(mockSubscriptionService.upsertSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
          organizationId: undefined,
        }),
      );
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle deleted customer during subscription creation', async () => {
      const deletedCustomerId = 'cus_deleted_123';

      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test_123',
            customer: deletedCustomerId,
            status: 'active',
            items: {
              data: [
                {
                  price: { id: TEST_PRICE_ID_STARTER },
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                },
              ],
            },
          },
        },
      });

      // Mock customer retrieve to return deleted customer
      const originalRetrieve = mockStripeCustomers.retrieve;
      mockStripeCustomers.retrieve = vi.fn().mockResolvedValue({
        id: deletedCustomerId,
        deleted: true,
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockRequest.log?.error).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: deletedCustomerId,
        }),
        expect.stringContaining('Customer not found or deleted'),
      );

      mockStripeCustomers.retrieve = originalRetrieve;
    });

    it('should handle subscription update with missing subscription in database', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_nonexistent',
            status: 'active',
            items: {
              data: [
                {
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                },
              ],
            },
          },
        },
      });

      mockSubscriptionService.updateSubscriptionStatus.mockRejectedValue(
        new Error('Subscription not found'),
      );

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
    });

    it('should handle invoice paid event with missing subscription', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_test_123',
            subscription: null, // No subscription linked
          },
        },
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      // Should complete successfully but not update subscription
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockSubscriptionService.updateSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('should handle invoice payment failed with missing subscription ID', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test_123',
            subscription: null,
            subscription_id: null,
            subscription_details: null,
          },
        },
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      // Should complete successfully but not update subscription
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockSubscriptionService.updateSubscriptionStatus).not.toHaveBeenCalled();
    });
  });

  describe('Transient Errors and Retry Scenarios', () => {
    it('should handle temporary database unavailability', async () => {
      const customer = await mockStripeCustomers.create({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-123' },
      });

      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test_123',
            customer: customer.id,
            status: 'active',
            items: {
              data: [
                {
                  price: { id: TEST_PRICE_ID_STARTER },
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                },
              ],
            },
          },
        },
      });

      mockSubscriptionService.upsertSubscription.mockRejectedValue(
        Object.assign(new Error('Connection pool timeout'), {
          code: 'P2024',
        }),
      );

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      // Stripe will retry based on 500 response
    });

    it('should handle Stripe API errors during customer retrieval', async () => {
      const customerId = 'cus_test_123';

      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test_123',
            customer: customerId,
            status: 'active',
            items: {
              data: [
                {
                  price: { id: TEST_PRICE_ID_STARTER },
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                },
              ],
            },
          },
        },
      });

      const originalRetrieve = mockStripeCustomers.retrieve;
      mockStripeCustomers.retrieve = vi.fn().mockRejectedValue(
        Object.assign(new Error('API Error'), {
          type: 'StripeAPIError',
          statusCode: 500,
        }),
      );

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);

      mockStripeCustomers.retrieve = originalRetrieve;
    });

    it('should handle rate limiting from Stripe during webhook processing', async () => {
      const customerId = 'cus_test_123';

      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test_123',
            customer: customerId,
            status: 'active',
            items: {
              data: [
                {
                  price: { id: TEST_PRICE_ID_STARTER },
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                },
              ],
            },
          },
        },
      });

      const originalRetrieve = mockStripeCustomers.retrieve;
      mockStripeCustomers.retrieve = vi.fn().mockRejectedValue(
        Object.assign(new Error('Rate limit exceeded'), {
          type: 'StripeRateLimitError',
          statusCode: 429,
        }),
      );

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);

      mockStripeCustomers.retrieve = originalRetrieve;
    });

    it('should handle timeout during subscription status update', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            status: 'active',
            items: {
              data: [
                {
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                },
              ],
            },
          },
        },
      });

      mockSubscriptionService.updateSubscriptionStatus.mockRejectedValue(
        Object.assign(new Error('Request timeout'), {
          code: 'ETIMEDOUT',
        }),
      );

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
    });

    it('should handle concurrent webhook deliveries for same subscription', async () => {
      const customer = await mockStripeCustomers.create({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-123' },
      });

      const webhookEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            customer: customer.id,
            status: 'active',
            items: {
              data: [
                {
                  current_period_start: Math.floor(Date.now() / 1000),
                  current_period_end: Math.floor(Date.now() / 1000) + 2592000,
                },
              ],
            },
          },
        },
      };

      mockStripeWebhooks.constructEvent.mockReturnValue(webhookEvent);
      mockSubscriptionService.updateSubscriptionStatus.mockResolvedValue(undefined as any);

      // Simulate concurrent webhook processing
      const promises = Array.from({ length: 3 }, () =>
        controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply),
      );

      await Promise.all(promises);

      // All should succeed
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should reject webhooks when Stripe is not configured', async () => {
      // Create a controller with no Stripe instance
      const unconfiguredController = new StripeWebhookController(mockSubscriptionService as any);
      (unconfiguredController as any).stripe = null;

      await unconfiguredController.handleWebhook(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Stripe is not configured',
      });
    });

    it('should reject webhooks when webhook secret is not configured', async () => {
      // Mock env without webhook secret
      const originalEnv = require('../config/env').env;
      vi.doMock('../config/env', () => ({
        env: {
          STRIPE_WEBHOOK_SECRET: undefined,
        },
      }));

      const controller = new StripeWebhookController(mockSubscriptionService as any);

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Stripe webhook secret is not configured',
      });

      // Restore
      vi.doMock('../config/env', () => ({ env: originalEnv }));
    });
  });

  describe('Unhandled Event Types', () => {
    it('should gracefully handle unknown event types', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.created',
        data: { object: {} },
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
      expect(mockRequest.log?.info).toHaveBeenCalledWith(
        { eventType: 'payment_intent.created' },
        'Unhandled webhook event type',
      );
    });

    it('should handle future Stripe event types gracefully', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'some.future.event.v2',
        data: { object: {} },
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('Invoice Event Edge Cases', () => {
    it('should handle invoice paid event with inactive subscription', async () => {
      const subscription = await mockStripeSubscriptions.create({
        customer: 'cus_test_123',
        items: [{ price: TEST_PRICE_ID_STARTER }],
      });

      // Cancel the subscription
      await mockStripeSubscriptions.cancel(subscription.id);

      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_test_123',
            subscription: subscription.id,
          },
        },
      });

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      // Should not update status to ACTIVE for canceled subscription
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle invoice payment failed for different API versions', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test_123',
            subscription_details: {
              subscription: 'sub_test_123',
            },
          },
        },
      });

      mockSubscriptionService.updateSubscriptionStatus.mockResolvedValue(undefined as any);

      await controller.handleWebhook(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith({
        stripeSubscriptionId: 'sub_test_123',
        status: 'PAST_DUE',
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });
  });
});
