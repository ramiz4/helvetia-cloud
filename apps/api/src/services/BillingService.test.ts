import { PrismaClient } from 'database';
import 'reflect-metadata';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testPriceIds, testSubscriptions } from '../test/fixtures/billing.fixtures';
import {
  createMockCheckoutSession,
  createMockCustomer,
  createMockInvoice,
  createMockPortalSession,
  createMockStripe,
  createMockSubscription,
} from '../test/mocks/stripe.mock';
import { BillingService } from './BillingService';

// Mock the Stripe config
vi.mock('../config/stripe', () => ({
  getStripeClient: vi.fn(),
  isStripeConfigured: vi.fn(),
}));

describe('BillingService', () => {
  let billingService: BillingService;
  let mockPrisma: any;
  let mockStripe: any;
  let getStripeClient: any;
  let isStripeConfigured: any;

  beforeEach(async () => {
    // Import the mocked functions
    const stripeConfig = await import('../config/stripe');
    getStripeClient = stripeConfig.getStripeClient;
    isStripeConfigured = stripeConfig.isStripeConfigured;

    // Create mock Prisma client
    mockPrisma = {
      subscription: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaClient;

    // Create mock Stripe client
    mockStripe = createMockStripe();

    // Mock Stripe configuration functions
    vi.mocked(isStripeConfigured).mockReturnValue(true);
    vi.mocked(getStripeClient).mockReturnValue(mockStripe);

    // Create service instance
    billingService = new BillingService(mockPrisma);
  });

  describe('getOrCreateCustomer', () => {
    it('should return existing customer ID if subscription exists', async () => {
      const existingSubscription = testSubscriptions.starter;
      mockPrisma.subscription.findFirst.mockResolvedValue(existingSubscription);

      const customerId = await billingService.getOrCreateCustomer({
        userId: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(customerId).toBe(existingSubscription.stripeCustomerId);
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: undefined,
        },
      });
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create new Stripe customer if subscription does not exist', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      const mockCustomer = createMockCustomer({ id: 'cus_new123' });
      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      const customerId = await billingService.getOrCreateCustomer({
        userId: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(customerId).toBe('cus_new123');
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: {
          userId: 'user-1',
          organizationId: '',
        },
      });
    });

    it('should support organization customers', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      const mockCustomer = createMockCustomer();
      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      await billingService.getOrCreateCustomer({
        organizationId: 'org-1',
        email: 'org@example.com',
        name: 'Test Org',
      });

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'org@example.com',
        name: 'Test Org',
        metadata: {
          userId: '',
          organizationId: 'org-1',
        },
      });
    });

    it('should throw error if Stripe is not configured', async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(false);
      vi.mocked(getStripeClient).mockReturnValue(null);

      // Create new service instance with unconfigured Stripe
      billingService = new BillingService(mockPrisma);

      await expect(
        billingService.getOrCreateCustomer({
          userId: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
        }),
      ).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('createSubscription', () => {
    it('should create a new subscription', async () => {
      const mockSubscription = createMockSubscription({
        id: 'sub_new123',
        status: 'active',
      });
      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const result = await billingService.createSubscription({
        customerId: 'cus_test123',
        priceId: testPriceIds.STARTER,
        userId: 'user-1',
      });

      expect(result).toEqual({
        subscriptionId: 'sub_new123',
        status: 'ACTIVE',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
      });

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        items: [{ price: testPriceIds.STARTER }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });
    });

    it('should map trialing status to ACTIVE', async () => {
      const mockSubscription = createMockSubscription({ status: 'trialing' });
      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const result = await billingService.createSubscription({
        customerId: 'cus_test123',
        priceId: testPriceIds.STARTER,
      });

      expect(result.status).toBe('ACTIVE');
    });

    it('should map past_due status correctly', async () => {
      const mockSubscription = createMockSubscription({ status: 'past_due' });
      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const result = await billingService.createSubscription({
        customerId: 'cus_test123',
        priceId: testPriceIds.STARTER,
      });

      expect(result.status).toBe('PAST_DUE');
    });

    it('should map canceled status correctly', async () => {
      const mockSubscription = createMockSubscription({ status: 'canceled' });
      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const result = await billingService.createSubscription({
        customerId: 'cus_test123',
        priceId: testPriceIds.STARTER,
      });

      expect(result.status).toBe('CANCELED');
    });

    it('should throw error if Stripe is not configured', async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(false);
      vi.mocked(getStripeClient).mockReturnValue(null);
      billingService = new BillingService(mockPrisma);

      await expect(
        billingService.createSubscription({
          customerId: 'cus_test123',
          priceId: testPriceIds.STARTER,
        }),
      ).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription with new price', async () => {
      const currentSubscription = createMockSubscription({
        id: 'sub_test123',
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test123',
              object: 'subscription_item',
              billing_thresholds: null,
              created: Date.now() / 1000,
              metadata: {},
              price: {
                id: testPriceIds.STARTER,
              } as any,
              quantity: 1,
              subscription: 'sub_test123',
              tax_rates: [],
              current_period_start: Date.now() / 1000,
              current_period_end: Date.now() / 1000 + 30 * 24 * 60 * 60,
            },
          ],
          has_more: false,
          url: '/v1/subscription_items',
        },
      });

      const updatedSubscription = createMockSubscription({
        id: 'sub_test123',
        status: 'active',
      });

      mockStripe.subscriptions.retrieve.mockResolvedValue(currentSubscription);
      mockStripe.subscriptions.update.mockResolvedValue(updatedSubscription);

      const result = await billingService.updateSubscription({
        subscriptionId: 'sub_test123',
        priceId: testPriceIds.PRO,
      });

      expect(result).toEqual({
        status: 'ACTIVE',
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        items: [
          {
            id: 'si_test123',
            price: testPriceIds.PRO,
          },
        ],
        proration_behavior: 'create_prorations',
      });
    });

    it('should throw error if subscription has no items', async () => {
      const subscriptionWithNoItems = createMockSubscription({
        items: {
          object: 'list',
          data: [],
          has_more: false,
          url: '/v1/subscription_items',
        },
      });

      mockStripe.subscriptions.retrieve.mockResolvedValue(subscriptionWithNoItems);

      await expect(
        billingService.updateSubscription({
          subscriptionId: 'sub_test123',
          priceId: testPriceIds.PRO,
        }),
      ).rejects.toThrow('Subscription has no items to update');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel a subscription', async () => {
      mockStripe.subscriptions.cancel.mockResolvedValue(
        createMockSubscription({ status: 'canceled' }),
      );

      await billingService.cancelSubscription('sub_test123');

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test123');
    });

    it('should throw error if Stripe is not configured', async () => {
      vi.mocked(isStripeConfigured).mockReturnValue(false);
      vi.mocked(getStripeClient).mockReturnValue(null);
      billingService = new BillingService(mockPrisma);

      await expect(billingService.cancelSubscription('sub_test123')).rejects.toThrow(
        'Stripe is not configured',
      );
    });
  });

  describe('getSubscription', () => {
    it('should retrieve a subscription', async () => {
      const mockSubscription = createMockSubscription();
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      const result = await billingService.getSubscription('sub_test123');

      expect(result).toEqual(mockSubscription);
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_test123');
    });

    it('should return null if subscription not found', async () => {
      const error = new Stripe.errors.StripeError({
        type: 'invalid_request_error',
        message: 'No such subscription',
      });
      (error as any).code = 'resource_missing';
      mockStripe.subscriptions.retrieve.mockRejectedValue(error);

      const result = await billingService.getSubscription('sub_invalid');

      expect(result).toBeNull();
    });

    it('should throw error for other Stripe errors', async () => {
      const error = new Stripe.errors.StripeError({
        type: 'api_error',
        message: 'API Error',
      });
      mockStripe.subscriptions.retrieve.mockRejectedValue(error);

      await expect(billingService.getSubscription('sub_test123')).rejects.toThrow('API Error');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session', async () => {
      const mockSession = createMockCheckoutSession({
        id: 'cs_new123',
        url: 'https://checkout.stripe.com/test',
      });
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const result = await billingService.createCheckoutSession({
        customerId: 'cus_test123',
        priceId: testPriceIds.STARTER,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result).toEqual({
        sessionId: 'cs_new123',
        url: 'https://checkout.stripe.com/test',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        mode: 'subscription',
        line_items: [
          {
            price: testPriceIds.STARTER,
            quantity: 1,
          },
        ],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });
    });
  });

  describe('createPortalSession', () => {
    it('should create a billing portal session', async () => {
      const mockSession = createMockPortalSession({
        url: 'https://billing.stripe.com/session/test',
      });
      mockStripe.billingPortal.sessions.create.mockResolvedValue(mockSession);

      const result = await billingService.createPortalSession({
        customerId: 'cus_test123',
        returnUrl: 'https://example.com/billing',
      });

      expect(result).toEqual({
        url: 'https://billing.stripe.com/session/test',
      });

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        return_url: 'https://example.com/billing',
      });
    });
  });

  describe('getInvoices', () => {
    it('should retrieve invoices for a customer', async () => {
      const mockInvoices = [createMockInvoice({ id: 'in_1' }), createMockInvoice({ id: 'in_2' })];
      mockStripe.invoices.list.mockResolvedValue({
        data: mockInvoices,
        has_more: false,
        object: 'list',
        url: '/v1/invoices',
      });

      const result = await billingService.getInvoices('cus_test123');

      expect(result).toEqual(mockInvoices);
      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_test123',
        limit: 10,
      });
    });

    it('should support custom limit', async () => {
      mockStripe.invoices.list.mockResolvedValue({
        data: [],
        has_more: false,
        object: 'list',
        url: '/v1/invoices',
      });

      await billingService.getInvoices('cus_test123', 25);

      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_test123',
        limit: 25,
      });
    });
  });

  describe('reportUsage', () => {
    it('should report usage for a subscription item', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockStripe.subscriptionItems.createUsageRecord.mockResolvedValue({});

      await billingService.reportUsage({
        subscriptionItemId: 'si_test123',
        quantity: 100.5,
        timestamp: now,
      });

      expect(mockStripe.subscriptionItems.createUsageRecord).toHaveBeenCalledWith('si_test123', {
        quantity: 101, // Rounded
        timestamp: now,
        action: 'increment',
      });
    });

    it('should use current timestamp if not provided', async () => {
      const beforeCall = Math.floor(Date.now() / 1000);
      mockStripe.subscriptionItems.createUsageRecord.mockResolvedValue({});

      await billingService.reportUsage({
        subscriptionItemId: 'si_test123',
        quantity: 50,
      });

      const call = mockStripe.subscriptionItems.createUsageRecord.mock.calls[0];
      expect(call[1].timestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(call[1].timestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it('should round quantity to nearest integer', async () => {
      mockStripe.subscriptionItems.createUsageRecord.mockResolvedValue({});

      await billingService.reportUsage({
        subscriptionItemId: 'si_test123',
        quantity: 25.6,
      });

      const call = mockStripe.subscriptionItems.createUsageRecord.mock.calls[0];
      expect(call[1].quantity).toBe(26);
    });
  });
});
