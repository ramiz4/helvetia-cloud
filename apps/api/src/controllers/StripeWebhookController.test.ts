import 'reflect-metadata';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StripeWebhookController } from './StripeWebhookController';
import {
  createMockSubscription,
  createMockInvoice,
  createMockWebhookEvent,
  createMockCustomer,
} from '../test/mocks/stripe.mock';
import { testPriceIds } from '../test/fixtures/billing.fixtures';

// Mock env config
vi.mock('../config/env', () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_PRICE_ID_STARTER: 'price_starter_test',
    STRIPE_PRICE_ID_PRO: 'price_pro_test',
    STRIPE_PRICE_ID_ENTERPRISE: 'price_enterprise_test',
  },
}));

// Mock Stripe config
vi.mock('../config/stripe', () => ({
  getStripeClient: vi.fn(),
}));

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let mockSubscriptionService: any;
  let mockStripe: any;
  let mockRequest: any;
  let mockReply: any;
  let getStripeClient: any;

  beforeEach(async () => {
    // Import the mocked function
    const stripeConfig = await import('../config/stripe');
    getStripeClient = stripeConfig.getStripeClient;

    // Mock Stripe client
    mockStripe = {
      webhooks: {
        constructEvent: vi.fn(),
      },
      customers: {
        retrieve: vi.fn(),
      },
      subscriptions: {
        retrieve: vi.fn(),
      },
    };

    vi.mocked(getStripeClient).mockReturnValue(mockStripe);

    // Mock subscription service
    mockSubscriptionService = {
      upsertSubscription: vi.fn(),
      updateSubscriptionStatus: vi.fn(),
    };

    // Mock Fastify request and reply
    mockRequest = {
      headers: {
        'stripe-signature': 'test_signature',
      },
      rawBody: Buffer.from(JSON.stringify({ type: 'test' })),
      body: {},
      log: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Create controller instance
    controller = new StripeWebhookController(mockSubscriptionService);
  });

  describe('handleWebhook', () => {
    it('should return 500 if Stripe is not configured', async () => {
      vi.mocked(getStripeClient).mockReturnValue(null);
      controller = new StripeWebhookController(mockSubscriptionService);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Stripe is not configured' });
    });

    it('should return 400 if stripe-signature header is missing', async () => {
      mockRequest.headers = {};

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Missing stripe-signature header' });
    });

    it('should return 400 if raw body is missing', async () => {
      mockRequest.rawBody = undefined;

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Missing raw body' });
    });

    it('should return 400 if webhook signature verification fails', async () => {
      const error = new Error('Signature verification failed');
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw error;
      });

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Webhook signature verification failed',
      });
      expect(mockRequest.log.error).toHaveBeenCalled();
    });

    it('should return 400 for malformed JSON', async () => {
      mockRequest.body = { _isMalformed: true, _error: 'Invalid JSON' };
      const mockEvent = createMockWebhookEvent('test.event', {});
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Malformed webhook JSON' });
    });

    it('should return 200 for successfully handled event', async () => {
      const mockEvent = createMockWebhookEvent('customer.subscription.created', createMockSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.customers.retrieve.mockResolvedValue(
        createMockCustomer({ metadata: { userId: 'user-1' } }),
      );
      mockSubscriptionService.upsertSubscription.mockResolvedValue(undefined);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ received: true });
    });

    it('should log unhandled event types', async () => {
      const mockEvent = createMockWebhookEvent('unhandled.event.type', {});
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockRequest.log.info).toHaveBeenCalledWith(
        { eventType: 'unhandled.event.type' },
        'Unhandled webhook event type',
      );
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 if event handler throws error', async () => {
      const mockEvent = createMockWebhookEvent('customer.subscription.created', createMockSubscription());
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.customers.retrieve.mockRejectedValue(new Error('Customer fetch failed'));

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Error handling webhook' });
      expect(mockRequest.log.error).toHaveBeenCalled();
    });
  });

  describe('customer.subscription.created', () => {
    it('should create subscription in database', async () => {
      const mockSubscription = createMockSubscription({
        id: 'sub_test123',
        customer: 'cus_test123',
        status: 'active',
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test123',
              price: { id: testPriceIds.STARTER } as any,
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            } as any,
          ],
          has_more: false,
          url: '',
        },
      });

      const mockCustomer = createMockCustomer({
        id: 'cus_test123',
        metadata: { userId: 'user-1', organizationId: '' },
      });

      const mockEvent = createMockWebhookEvent('customer.subscription.created', mockSubscription);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);
      mockSubscriptionService.upsertSubscription.mockResolvedValue(undefined);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockSubscriptionService.upsertSubscription).toHaveBeenCalledWith({
        userId: 'user-1',
        organizationId: undefined,
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test123',
        plan: 'STARTER',
        status: 'ACTIVE',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
      });

      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should map PRO plan correctly', async () => {
      const mockSubscription = createMockSubscription({
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test123',
              price: { id: testPriceIds.PRO } as any,
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            } as any,
          ],
          has_more: false,
          url: '',
        },
      });

      const mockEvent = createMockWebhookEvent('customer.subscription.created', mockSubscription);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.customers.retrieve.mockResolvedValue(
        createMockCustomer({ metadata: { userId: 'user-1' } }),
      );

      await controller.handleWebhook(mockRequest, mockReply);

      const call = mockSubscriptionService.upsertSubscription.mock.calls[0][0];
      expect(call.plan).toBe('PRO');
    });

    it('should map ENTERPRISE plan correctly', async () => {
      const mockSubscription = createMockSubscription({
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test123',
              price: { id: testPriceIds.ENTERPRISE } as any,
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            } as any,
          ],
          has_more: false,
          url: '',
        },
      });

      const mockEvent = createMockWebhookEvent('customer.subscription.created', mockSubscription);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.customers.retrieve.mockResolvedValue(
        createMockCustomer({ metadata: { userId: 'user-1' } }),
      );

      await controller.handleWebhook(mockRequest, mockReply);

      const call = mockSubscriptionService.upsertSubscription.mock.calls[0][0];
      expect(call.plan).toBe('ENTERPRISE');
    });

    it('should default to FREE for unknown price IDs', async () => {
      const mockSubscription = createMockSubscription({
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test123',
              price: { id: 'price_unknown' } as any,
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            } as any,
          ],
          has_more: false,
          url: '',
        },
      });

      const mockEvent = createMockWebhookEvent('customer.subscription.created', mockSubscription);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.customers.retrieve.mockResolvedValue(
        createMockCustomer({ metadata: { userId: 'user-1' } }),
      );

      await controller.handleWebhook(mockRequest, mockReply);

      const call = mockSubscriptionService.upsertSubscription.mock.calls[0][0];
      expect(call.plan).toBe('FREE');
      expect(mockRequest.log.warn).toHaveBeenCalled();
    });

    it('should handle organization subscriptions', async () => {
      const mockSubscription = createMockSubscription();
      const mockCustomer = createMockCustomer({
        metadata: { userId: '', organizationId: 'org-1' },
      });

      const mockEvent = createMockWebhookEvent('customer.subscription.created', mockSubscription);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      await controller.handleWebhook(mockRequest, mockReply);

      const call = mockSubscriptionService.upsertSubscription.mock.calls[0][0];
      expect(call.organizationId).toBe('org-1');
      expect(call.userId).toBeUndefined();
    });

    it('should throw error if customer not found', async () => {
      const mockSubscription = createMockSubscription();
      const mockEvent = createMockWebhookEvent('customer.subscription.created', mockSubscription);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.customers.retrieve.mockResolvedValue({ deleted: true });

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockRequest.log.error).toHaveBeenCalled();
    });
  });

  describe('customer.subscription.updated', () => {
    it('should update subscription status', async () => {
      const mockSubscription = createMockSubscription({
        id: 'sub_test123',
        status: 'active',
      });

      const mockEvent = createMockWebhookEvent('customer.subscription.updated', mockSubscription);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith({
        stripeSubscriptionId: 'sub_test123',
        status: 'ACTIVE',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
      });

      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should map different statuses correctly', async () => {
      const statuses: Array<[Stripe.Subscription.Status, string]> = [
        ['active', 'ACTIVE'],
        ['trialing', 'ACTIVE'],
        ['past_due', 'PAST_DUE'],
        ['canceled', 'CANCELED'],
        ['incomplete_expired', 'CANCELED'],
        ['incomplete', 'UNPAID'],
        ['unpaid', 'UNPAID'],
      ];

      for (const [stripeStatus, expectedStatus] of statuses) {
        mockSubscriptionService.updateSubscriptionStatus.mockClear();

        const mockSubscription = createMockSubscription({ status: stripeStatus });
        const mockEvent = createMockWebhookEvent('customer.subscription.updated', mockSubscription);
        mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

        await controller.handleWebhook(mockRequest, mockReply);

        const call = mockSubscriptionService.updateSubscriptionStatus.mock.calls[0][0];
        expect(call.status).toBe(expectedStatus);
      }
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should mark subscription as canceled', async () => {
      const mockSubscription = createMockSubscription({ id: 'sub_test123' });
      const mockEvent = createMockWebhookEvent('customer.subscription.deleted', mockSubscription);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith({
        stripeSubscriptionId: 'sub_test123',
        status: 'CANCELED',
      });

      expect(mockReply.status).toHaveBeenCalledWith(200);
    });
  });

  describe('invoice.paid', () => {
    it('should update subscription to active', async () => {
      const mockInvoice = createMockInvoice({
        id: 'in_test123',
        subscription: 'sub_test123',
      });
      const mockSubscription = createMockSubscription({ status: 'active' });

      const mockEvent = createMockWebhookEvent('invoice.paid', mockInvoice);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith({
        stripeSubscriptionId: 'sub_test123',
        status: 'ACTIVE',
      });

      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle invoice with subscription object', async () => {
      const mockSubscriptionObj = createMockSubscription({ id: 'sub_test123', status: 'active' });
      const mockInvoice = createMockInvoice({
        subscription: mockSubscriptionObj,
      });

      const mockEvent = createMockWebhookEvent('invoice.paid', mockInvoice);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscriptionObj);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_test123');
      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith({
        stripeSubscriptionId: 'sub_test123',
        status: 'ACTIVE',
      });
    });

    it('should not update if subscription is not active', async () => {
      const mockInvoice = createMockInvoice({ subscription: 'sub_test123' });
      const mockSubscription = createMockSubscription({ status: 'past_due' });

      const mockEvent = createMockWebhookEvent('invoice.paid', mockInvoice);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockSubscriptionService.updateSubscriptionStatus).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle invoice without subscription ID', async () => {
      const mockInvoice = createMockInvoice({ subscription: null });
      const mockEvent = createMockWebhookEvent('invoice.paid', mockInvoice);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
      expect(mockSubscriptionService.updateSubscriptionStatus).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });
  });

  describe('invoice.payment_failed', () => {
    it('should mark subscription as past due', async () => {
      const mockInvoice = createMockInvoice({
        id: 'in_test123',
        subscription: 'sub_test123',
      });

      const mockEvent = createMockWebhookEvent('invoice.payment_failed', mockInvoice);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith({
        stripeSubscriptionId: 'sub_test123',
        status: 'PAST_DUE',
      });

      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should handle invoice without subscription ID', async () => {
      const mockInvoice = createMockInvoice({ subscription: null });
      const mockEvent = createMockWebhookEvent('invoice.payment_failed', mockInvoice);
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      await controller.handleWebhook(mockRequest, mockReply);

      expect(mockSubscriptionService.updateSubscriptionStatus).not.toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });
  });
});
