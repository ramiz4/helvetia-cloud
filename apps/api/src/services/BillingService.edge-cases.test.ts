import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testStripePrices, testUsers } from '../test/fixtures/billing.fixtures';
import {
  createMockStripe,
  mockStripeCustomers,
  mockStripeSubscriptions,
  resetMockStripe,
} from '../test/mocks/stripe.mock';
import { BillingService } from './BillingService';

// Mock the stripe config
vi.mock('../config/stripe', () => ({
  getStripeClient: () => createMockStripe(),
  isStripeConfigured: () => true,
  getStripePriceIds: () => ({
    STARTER: testStripePrices.starter,
    PRO: testStripePrices.pro,
    ENTERPRISE: testStripePrices.enterprise,
  }),
}));

// Mock Prisma
const mockPrisma = {
  subscription: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('database', () => ({
  prisma: mockPrisma,
  PrismaClient: vi.fn(),
}));

describe('BillingService - Edge Cases and Error Handling', () => {
  let billingService: BillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStripe();
    billingService = new BillingService(mockPrisma as any);
  });

  describe('Stripe API Error Conditions', () => {
    describe('Rate Limiting', () => {
      it('should handle rate limit errors from Stripe API', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(null);

        // Mock Stripe to throw rate limit error
        const originalCreate = mockStripeCustomers.create;
        mockStripeCustomers.create = vi.fn().mockRejectedValue(
          Object.assign(new Error('Rate limit exceeded'), {
            type: 'StripeRateLimitError',
            statusCode: 429,
            code: 'rate_limit',
          }),
        );

        await expect(
          billingService.getOrCreateCustomer({
            userId: testUsers.freeUser.id,
            email: testUsers.freeUser.email,
            name: testUsers.freeUser.username,
          }),
        ).rejects.toMatchObject({
          message: 'Rate limit exceeded',
          type: 'StripeRateLimitError',
        });

        mockStripeCustomers.create = originalCreate;
      });

      it('should handle rate limit errors when creating subscriptions', async () => {
        const customer = await mockStripeCustomers.create({
          email: testUsers.freeUser.email,
          name: testUsers.freeUser.username,
        });

        const originalCreate = mockStripeSubscriptions.create;
        mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
          Object.assign(new Error('Too many requests'), {
            type: 'StripeRateLimitError',
            statusCode: 429,
          }),
        );

        await expect(
          billingService.createSubscription({
            customerId: customer.id,
            priceId: testStripePrices.starter,
            userId: testUsers.freeUser.id,
          }),
        ).rejects.toMatchObject({
          message: 'Too many requests',
          statusCode: 429,
        });

        mockStripeSubscriptions.create = originalCreate;
      });
    });

    describe('Network Failures', () => {
      it('should handle network timeout errors', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(null);

        const originalCreate = mockStripeCustomers.create;
        mockStripeCustomers.create = vi.fn().mockRejectedValue(
          Object.assign(new Error('Request timeout'), {
            type: 'StripeConnectionError',
            code: 'ETIMEDOUT',
          }),
        );

        await expect(
          billingService.getOrCreateCustomer({
            userId: testUsers.freeUser.id,
            email: testUsers.freeUser.email,
            name: testUsers.freeUser.username,
          }),
        ).rejects.toMatchObject({
          message: 'Request timeout',
          type: 'StripeConnectionError',
        });

        mockStripeCustomers.create = originalCreate;
      });

      it('should handle connection refused errors', async () => {
        const customer = await mockStripeCustomers.create({
          email: testUsers.freeUser.email,
          name: testUsers.freeUser.username,
        });

        const originalRetrieve = mockStripeSubscriptions.retrieve;
        mockStripeSubscriptions.retrieve = vi.fn().mockRejectedValue(
          Object.assign(new Error('Connection refused'), {
            type: 'StripeConnectionError',
            code: 'ECONNREFUSED',
          }),
        );

        await expect(billingService.getSubscription('sub_test_123')).rejects.toMatchObject({
          message: 'Connection refused',
          type: 'StripeConnectionError',
        });

        mockStripeSubscriptions.retrieve = originalRetrieve;
      });
    });

    describe('Invalid Request Errors', () => {
      it('should handle invalid email format errors', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(null);

        const originalCreate = mockStripeCustomers.create;
        mockStripeCustomers.create = vi.fn().mockRejectedValue(
          Object.assign(new Error('Invalid email format'), {
            type: 'StripeInvalidRequestError',
            statusCode: 400,
            param: 'email',
          }),
        );

        await expect(
          billingService.getOrCreateCustomer({
            userId: testUsers.freeUser.id,
            email: 'invalid-email',
            name: testUsers.freeUser.username,
          }),
        ).rejects.toMatchObject({
          type: 'StripeInvalidRequestError',
          param: 'email',
        });

        mockStripeCustomers.create = originalCreate;
      });

      it('should handle invalid price ID errors', async () => {
        const customer = await mockStripeCustomers.create({
          email: testUsers.freeUser.email,
          name: testUsers.freeUser.username,
        });

        const originalCreate = mockStripeSubscriptions.create;
        mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
          Object.assign(new Error('No such price: invalid_price_id'), {
            type: 'StripeInvalidRequestError',
            statusCode: 400,
            param: 'items[0][price]',
            code: 'resource_missing',
          }),
        );

        await expect(
          billingService.createSubscription({
            customerId: customer.id,
            priceId: 'invalid_price_id',
            userId: testUsers.freeUser.id,
          }),
        ).rejects.toMatchObject({
          type: 'StripeInvalidRequestError',
          code: 'resource_missing',
        });

        mockStripeSubscriptions.create = originalCreate;
      });

      it('should handle missing customer errors', async () => {
        const originalCreate = mockStripeSubscriptions.create;
        mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
          Object.assign(new Error('No such customer: cus_invalid'), {
            type: 'StripeInvalidRequestError',
            statusCode: 404,
            code: 'resource_missing',
          }),
        );

        await expect(
          billingService.createSubscription({
            customerId: 'cus_invalid',
            priceId: testStripePrices.starter,
            userId: testUsers.freeUser.id,
          }),
        ).rejects.toMatchObject({
          type: 'StripeInvalidRequestError',
          code: 'resource_missing',
        });

        mockStripeSubscriptions.create = originalCreate;
      });
    });

    describe('Authentication Errors', () => {
      it('should handle invalid API key errors', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(null);

        const originalCreate = mockStripeCustomers.create;
        mockStripeCustomers.create = vi.fn().mockRejectedValue(
          Object.assign(new Error('Invalid API Key provided'), {
            type: 'StripeAuthenticationError',
            statusCode: 401,
          }),
        );

        await expect(
          billingService.getOrCreateCustomer({
            userId: testUsers.freeUser.id,
            email: testUsers.freeUser.email,
            name: testUsers.freeUser.username,
          }),
        ).rejects.toMatchObject({
          type: 'StripeAuthenticationError',
          statusCode: 401,
        });

        mockStripeCustomers.create = originalCreate;
      });

      it('should handle expired API key errors', async () => {
        const customer = await mockStripeCustomers.create({
          email: testUsers.freeUser.email,
          name: testUsers.freeUser.username,
        });

        const originalCreate = mockStripeSubscriptions.create;
        mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
          Object.assign(new Error('Your API key has expired'), {
            type: 'StripeAuthenticationError',
            statusCode: 401,
            code: 'api_key_expired',
          }),
        );

        await expect(
          billingService.createSubscription({
            customerId: customer.id,
            priceId: testStripePrices.starter,
            userId: testUsers.freeUser.id,
          }),
        ).rejects.toMatchObject({
          type: 'StripeAuthenticationError',
          code: 'api_key_expired',
        });

        mockStripeSubscriptions.create = originalCreate;
      });
    });

    describe('Permission Errors', () => {
      it('should handle permission denied errors for test mode restrictions', async () => {
        const customer = await mockStripeCustomers.create({
          email: testUsers.freeUser.email,
          name: testUsers.freeUser.username,
        });

        const originalCreate = mockStripeSubscriptions.create;
        mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
          Object.assign(new Error('This resource is not available in test mode'), {
            type: 'StripePermissionError',
            statusCode: 403,
          }),
        );

        await expect(
          billingService.createSubscription({
            customerId: customer.id,
            priceId: testStripePrices.starter,
            userId: testUsers.freeUser.id,
          }),
        ).rejects.toMatchObject({
          type: 'StripePermissionError',
          statusCode: 403,
        });

        mockStripeSubscriptions.create = originalCreate;
      });
    });
  });

  describe('Transaction Failures', () => {
    it('should handle payment method required errors', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const originalCreate = mockStripeSubscriptions.create;
      mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
        Object.assign(new Error('This customer has no attached payment source'), {
          type: 'StripeCardError',
          statusCode: 402,
          code: 'missing_payment_method',
        }),
      );

      await expect(
        billingService.createSubscription({
          customerId: customer.id,
          priceId: testStripePrices.starter,
          userId: testUsers.freeUser.id,
        }),
      ).rejects.toMatchObject({
        type: 'StripeCardError',
        code: 'missing_payment_method',
      });

      mockStripeSubscriptions.create = originalCreate;
    });

    it('should handle card declined errors', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const originalCreate = mockStripeSubscriptions.create;
      mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
        Object.assign(new Error('Your card was declined'), {
          type: 'StripeCardError',
          statusCode: 402,
          code: 'card_declined',
          decline_code: 'generic_decline',
        }),
      );

      await expect(
        billingService.createSubscription({
          customerId: customer.id,
          priceId: testStripePrices.starter,
          userId: testUsers.freeUser.id,
        }),
      ).rejects.toMatchObject({
        type: 'StripeCardError',
        code: 'card_declined',
      });

      mockStripeSubscriptions.create = originalCreate;
    });

    it('should handle insufficient funds errors', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const originalCreate = mockStripeSubscriptions.create;
      mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
        Object.assign(new Error('Your card has insufficient funds'), {
          type: 'StripeCardError',
          statusCode: 402,
          code: 'card_declined',
          decline_code: 'insufficient_funds',
        }),
      );

      await expect(
        billingService.createSubscription({
          customerId: customer.id,
          priceId: testStripePrices.starter,
          userId: testUsers.freeUser.id,
        }),
      ).rejects.toMatchObject({
        code: 'card_declined',
        decline_code: 'insufficient_funds',
      });

      mockStripeSubscriptions.create = originalCreate;
    });

    it('should handle expired card errors', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const originalCreate = mockStripeSubscriptions.create;
      mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
        Object.assign(new Error('Your card has expired'), {
          type: 'StripeCardError',
          statusCode: 402,
          code: 'expired_card',
        }),
      );

      await expect(
        billingService.createSubscription({
          customerId: customer.id,
          priceId: testStripePrices.starter,
          userId: testUsers.freeUser.id,
        }),
      ).rejects.toMatchObject({
        type: 'StripeCardError',
        code: 'expired_card',
      });

      mockStripeSubscriptions.create = originalCreate;
    });
  });

  describe('Customer/Subscription State Edge Cases', () => {
    it('should handle deleted customer gracefully', async () => {
      const customerId = 'cus_deleted_123';

      const originalRetrieve = mockStripeCustomers.retrieve;
      mockStripeCustomers.retrieve = vi.fn().mockResolvedValue({
        id: customerId,
        deleted: true,
      } as any);

      const originalCreate = mockStripeSubscriptions.create;
      mockStripeSubscriptions.create = vi.fn().mockRejectedValue(
        Object.assign(new Error('No such customer'), {
          type: 'StripeInvalidRequestError',
          statusCode: 404,
        }),
      );

      await expect(
        billingService.createSubscription({
          customerId,
          priceId: testStripePrices.starter,
          userId: testUsers.freeUser.id,
        }),
      ).rejects.toMatchObject({
        type: 'StripeInvalidRequestError',
      });

      mockStripeCustomers.retrieve = originalRetrieve;
      mockStripeSubscriptions.create = originalCreate;
    });

    it('should handle subscription without items gracefully', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const subscription = await billingService.createSubscription({
        customerId: customer.id,
        priceId: testStripePrices.starter,
        userId: testUsers.freeUser.id,
      });

      // Mock retrieve to return subscription without items
      const originalRetrieve = mockStripeSubscriptions.retrieve;
      mockStripeSubscriptions.retrieve = vi.fn().mockResolvedValue({
        id: subscription.subscriptionId,
        items: { data: [] },
      } as any);

      await expect(
        billingService.updateSubscription({
          subscriptionId: subscription.subscriptionId,
          priceId: testStripePrices.pro,
        }),
      ).rejects.toThrow('Subscription has no items to update');

      mockStripeSubscriptions.retrieve = originalRetrieve;
    });

    it('should handle missing subscription when retrieving', async () => {
      const result = await billingService.getSubscription('sub_nonexistent_12345');
      expect(result).toBeNull();
    });

    it('should handle concurrent subscription creation attempts', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const promises = Array.from({ length: 5 }, (_, i) =>
        billingService.getOrCreateCustomer({
          userId: `user-${i}`,
          email: `user${i}@test.com`,
          name: `User ${i}`,
        }),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach((customerId) => {
        expect(customerId).toMatch(/^cus_test_/);
      });
    });

    it('should handle updating already canceled subscription', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const subscription = await billingService.createSubscription({
        customerId: customer.id,
        priceId: testStripePrices.starter,
        userId: testUsers.freeUser.id,
      });

      await billingService.cancelSubscription(subscription.subscriptionId);

      const originalUpdate = mockStripeSubscriptions.update;
      mockStripeSubscriptions.update = vi.fn().mockRejectedValue(
        Object.assign(new Error('Cannot update a canceled subscription'), {
          type: 'StripeInvalidRequestError',
          statusCode: 400,
        }),
      );

      await expect(
        billingService.updateSubscription({
          subscriptionId: subscription.subscriptionId,
          priceId: testStripePrices.pro,
        }),
      ).rejects.toMatchObject({
        type: 'StripeInvalidRequestError',
      });

      mockStripeSubscriptions.update = originalUpdate;
    });

    it('should handle double cancellation attempts', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const subscription = await billingService.createSubscription({
        customerId: customer.id,
        priceId: testStripePrices.starter,
        userId: testUsers.freeUser.id,
      });

      await billingService.cancelSubscription(subscription.subscriptionId);

      const originalCancel = mockStripeSubscriptions.cancel;
      mockStripeSubscriptions.cancel = vi.fn().mockRejectedValue(
        Object.assign(new Error('Subscription is already canceled'), {
          type: 'StripeInvalidRequestError',
          statusCode: 400,
        }),
      );

      await expect(billingService.cancelSubscription(subscription.subscriptionId)).rejects.toThrow(
        'Subscription is already canceled',
      );

      mockStripeSubscriptions.cancel = originalCancel;
    });
  });

  describe('Checkout and Portal Session Edge Cases', () => {
    it('should handle checkout session creation with missing customer', async () => {
      const originalCreate = vi
        .spyOn(createMockStripe().checkout!.sessions, 'create')
        .mockRejectedValue(
          Object.assign(new Error('No such customer'), {
            type: 'StripeInvalidRequestError',
            statusCode: 404,
          }),
        );

      await expect(
        billingService.createCheckoutSession({
          customerId: 'cus_invalid_123',
          priceId: testStripePrices.starter,
          successUrl: 'https://app.example.com/success',
          cancelUrl: 'https://app.example.com/cancel',
        }),
      ).rejects.toThrow();

      originalCreate.mockRestore();
    });

    it('should handle portal session creation with deleted customer', async () => {
      const originalCreate = vi
        .spyOn(createMockStripe().billingPortal!.sessions, 'create')
        .mockRejectedValue(
          Object.assign(new Error('No such customer'), {
            type: 'StripeInvalidRequestError',
            statusCode: 404,
          }),
        );

      await expect(
        billingService.createPortalSession({
          customerId: 'cus_deleted_123',
          returnUrl: 'https://app.example.com/settings',
        }),
      ).rejects.toThrow();

      originalCreate.mockRestore();
    });

    it('should handle invalid URLs in checkout session', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const originalCreate = vi
        .spyOn(createMockStripe().checkout!.sessions, 'create')
        .mockRejectedValue(
          Object.assign(new Error('Invalid URL format'), {
            type: 'StripeInvalidRequestError',
            statusCode: 400,
            param: 'success_url',
          }),
        );

      await expect(
        billingService.createCheckoutSession({
          customerId: customer.id,
          priceId: testStripePrices.starter,
          successUrl: 'invalid-url',
          cancelUrl: 'https://app.example.com/cancel',
        }),
      ).rejects.toThrow();

      originalCreate.mockRestore();
    });
  });

  describe('Invoice Edge Cases', () => {
    it('should handle retrieving invoices for customer with no invoices', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const invoices = await billingService.getInvoices(customer.id);
      expect(invoices).toEqual([]);
    });

    it('should handle invoices list API error', async () => {
      const customer = await mockStripeCustomers.create({
        email: testUsers.freeUser.email,
        name: testUsers.freeUser.username,
      });

      const originalList = vi.spyOn(createMockStripe().invoices!, 'list').mockRejectedValue(
        Object.assign(new Error('API error occurred'), {
          type: 'StripeAPIError',
          statusCode: 500,
        }),
      );

      await expect(billingService.getInvoices(customer.id)).rejects.toMatchObject({
        type: 'StripeAPIError',
      });

      originalList.mockRestore();
    });
  });

  describe('Usage Reporting Edge Cases', () => {
    it('should handle usage reporting for non-existent subscription item', async () => {
      const originalReportUsage = vi
        .spyOn(createMockStripe().subscriptionItems as any, 'createUsageRecord')
        .mockRejectedValue(
          Object.assign(new Error('No such subscription_item'), {
            type: 'StripeInvalidRequestError',
            statusCode: 404,
            code: 'resource_missing',
          }),
        );

      await expect(
        billingService.reportUsage({
          subscriptionItemId: 'si_nonexistent',
          quantity: 100,
        }),
      ).rejects.toMatchObject({
        code: 'resource_missing',
      });

      originalReportUsage.mockRestore();
    });

    it('should handle negative quantity in usage reporting', async () => {
      const originalReportUsage = vi
        .spyOn(createMockStripe().subscriptionItems as any, 'createUsageRecord')
        .mockRejectedValue(
          Object.assign(new Error('Quantity must be a positive integer'), {
            type: 'StripeInvalidRequestError',
            statusCode: 400,
            param: 'quantity',
          }),
        );

      await expect(
        billingService.reportUsage({
          subscriptionItemId: 'si_test_1',
          quantity: -50,
        }),
      ).rejects.toMatchObject({
        param: 'quantity',
      });

      originalReportUsage.mockRestore();
    });

    it('should handle extremely large quantity in usage reporting', async () => {
      // Test that very large quantities are handled appropriately
      await expect(
        billingService.reportUsage({
          subscriptionItemId: 'si_test_1',
          quantity: Number.MAX_SAFE_INTEGER,
        }),
      ).resolves.not.toThrow();
    });

    it('should handle decimal quantity rounding', async () => {
      // The service should round decimal quantities
      await expect(
        billingService.reportUsage({
          subscriptionItemId: 'si_test_1',
          quantity: 123.456,
        }),
      ).resolves.not.toThrow();
    });

    it('should handle usage reporting with timestamp in the future', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400; // 1 day in future

      const originalReportUsage = vi
        .spyOn(createMockStripe().subscriptionItems as any, 'createUsageRecord')
        .mockRejectedValue(
          Object.assign(new Error('Timestamp cannot be in the future'), {
            type: 'StripeInvalidRequestError',
            statusCode: 400,
            param: 'timestamp',
          }),
        );

      await expect(
        billingService.reportUsage({
          subscriptionItemId: 'si_test_1',
          quantity: 100,
          timestamp: futureTimestamp,
        }),
      ).rejects.toMatchObject({
        param: 'timestamp',
      });

      originalReportUsage.mockRestore();
    });
  });

  describe('Stripe Configuration Edge Cases', () => {
    it('should throw error when Stripe is not configured', async () => {
      // Test that operations fail when Stripe is not available
      // The service is initialized with Stripe, but we can test operations that check Stripe availability

      const originalStripe = (billingService as any).stripe;
      (billingService as any).stripe = null;

      await expect(
        billingService.getOrCreateCustomer({
          userId: testUsers.freeUser.id,
          email: testUsers.freeUser.email,
          name: testUsers.freeUser.username,
        }),
      ).rejects.toThrow('Stripe is not configured');

      // Restore
      (billingService as any).stripe = originalStripe;
    });
  });
});
