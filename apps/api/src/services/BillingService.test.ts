import { SubscriptionStatus } from 'database';
import 'reflect-metadata';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as stripeConfig from '../config/stripe';
import { BillingService } from './BillingService';

// Mock the stripe configuration module
vi.mock('../config/stripe');

describe('BillingService', () => {
  let billingService: BillingService;
  let mockPrisma: any;
  let mockStripe: any;

  beforeEach(() => {
    // Setup mocked functions
    const getStripeClientMock = vi.mocked(stripeConfig.getStripeClient);
    const isStripeConfiguredMock = vi.mocked(stripeConfig.isStripeConfigured);

    // Create mock Prisma client
    mockPrisma = {
      subscription: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    } as any;

    // Create mock Stripe client
    mockStripe = {
      customers: {
        create: vi.fn(),
      },
      subscriptions: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: vi.fn(),
        },
      },
      invoices: {
        list: vi.fn(),
      },
      subscriptionItems: {
        createUsageRecord: vi.fn(),
      },
    } as any;

    // Setup default mocks
    getStripeClientMock.mockReturnValue(mockStripe);
    isStripeConfiguredMock.mockReturnValue(true);

    vi.clearAllMocks();

    // Re-set mocks after clearing
    getStripeClientMock.mockReturnValue(mockStripe);
    isStripeConfiguredMock.mockReturnValue(true);

    billingService = new BillingService(mockPrisma);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with Stripe client', () => {
      expect(billingService).toBeDefined();
      expect(stripeConfig.getStripeClient).toHaveBeenCalled();
    });

    it('should handle missing Stripe configuration', () => {
      vi.mocked(stripeConfig.getStripeClient).mockReturnValue(null);
      const service = new BillingService(mockPrisma);
      expect(service).toBeDefined();
    });
  });

  describe('ensureStripeConfigured', () => {
    it('should throw error when Stripe is not configured', async () => {
      vi.mocked(stripeConfig.getStripeClient).mockReturnValue(null);
      vi.mocked(stripeConfig.isStripeConfigured).mockReturnValue(false);

      const service = new BillingService(mockPrisma);

      await expect(
        service.getOrCreateCustomer({
          userId: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
        }),
      ).rejects.toThrow('Stripe is not configured');
    });

    it('should return Stripe client when configured', async () => {
      const mockCustomerId = 'cus_test123';
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(mockStripe.customers.create).mockResolvedValue({
        id: mockCustomerId,
      } as any);

      const customerId = await billingService.getOrCreateCustomer({
        userId: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(customerId).toBe(mockCustomerId);
    });
  });

  describe('getOrCreateCustomer', () => {
    it('should return existing customer ID from database', async () => {
      const existingCustomerId = 'cus_existing123';
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue({
        id: 'sub-1',
        stripeCustomerId: existingCustomerId,
        stripeSubscriptionId: 'sub_test',
        status: SubscriptionStatus.ACTIVE,
        userId: 'user-1',
        organizationId: null,
        priceId: 'price_test',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const customerId = await billingService.getOrCreateCustomer({
        userId: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(customerId).toBe(existingCustomerId);
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: undefined,
        },
      });
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create new Stripe customer when none exists', async () => {
      const newCustomerId = 'cus_new123';
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(mockStripe.customers.create).mockResolvedValue({
        id: newCustomerId,
        email: 'test@example.com',
        name: 'Test User',
        metadata: {
          userId: 'user-1',
          organizationId: '',
        },
      } as any);

      const customerId = await billingService.getOrCreateCustomer({
        userId: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(customerId).toBe(newCustomerId);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: {
          userId: 'user-1',
          organizationId: '',
        },
      });
    });

    it('should handle organization customer creation', async () => {
      const newCustomerId = 'cus_org123';
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(mockStripe.customers.create).mockResolvedValue({
        id: newCustomerId,
      } as any);

      const customerId = await billingService.getOrCreateCustomer({
        organizationId: 'org-1',
        email: 'org@example.com',
        name: 'Test Org',
      });

      expect(customerId).toBe(newCustomerId);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'org@example.com',
        name: 'Test Org',
        metadata: {
          userId: '',
          organizationId: 'org-1',
        },
      });
    });

    it('should handle Stripe API errors', async () => {
      vi.mocked(mockPrisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(mockStripe.customers.create).mockRejectedValue(new Error('Stripe API error'));

      await expect(
        billingService.getOrCreateCustomer({
          userId: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
        }),
      ).rejects.toThrow('Stripe API error');
    });
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_test123',
        status: 'active' as Stripe.Subscription.Status,
        items: {
          data: [
            {
              id: 'si_test',
              current_period_start: 1640000000,
              current_period_end: 1642592000,
            },
          ],
        },
      };

      vi.mocked(mockStripe.subscriptions.create).mockResolvedValue(mockSubscription as any);

      const result = await billingService.createSubscription({
        customerId: 'cus_test',
        priceId: 'price_test',
        userId: 'user-1',
      });

      expect(result).toEqual({
        subscriptionId: 'sub_test123',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(1640000000 * 1000),
        currentPeriodEnd: new Date(1642592000 * 1000),
      });

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_test',
        items: [{ price: 'price_test' }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });
    });

    it('should map Stripe status correctly', async () => {
      const testCases: Array<{
        stripeStatus: Stripe.Subscription.Status;
        expectedStatus: SubscriptionStatus;
      }> = [
        { stripeStatus: 'active', expectedStatus: SubscriptionStatus.ACTIVE },
        { stripeStatus: 'trialing', expectedStatus: SubscriptionStatus.ACTIVE },
        { stripeStatus: 'past_due', expectedStatus: SubscriptionStatus.PAST_DUE },
        { stripeStatus: 'canceled', expectedStatus: SubscriptionStatus.CANCELED },
        { stripeStatus: 'incomplete_expired', expectedStatus: SubscriptionStatus.CANCELED },
        { stripeStatus: 'incomplete', expectedStatus: SubscriptionStatus.UNPAID },
        { stripeStatus: 'unpaid', expectedStatus: SubscriptionStatus.UNPAID },
      ];

      for (const { stripeStatus, expectedStatus } of testCases) {
        vi.mocked(mockStripe.subscriptions.create).mockResolvedValue({
          id: 'sub_test',
          status: stripeStatus,
          items: {
            data: [
              {
                id: 'si_test',
                current_period_start: 1640000000,
                current_period_end: 1642592000,
              },
            ],
          },
        } as any);

        const result = await billingService.createSubscription({
          customerId: 'cus_test',
          priceId: 'price_test',
        });

        expect(result.status).toBe(expectedStatus);
      }
    });

    it('should handle Stripe API errors', async () => {
      vi.mocked(mockStripe.subscriptions.create).mockRejectedValue(
        new Error('Payment method required'),
      );

      await expect(
        billingService.createSubscription({
          customerId: 'cus_test',
          priceId: 'price_test',
        }),
      ).rejects.toThrow('Payment method required');
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription with new price', async () => {
      const mockRetrievedSubscription = {
        id: 'sub_test',
        items: {
          data: [{ id: 'si_test' }],
        },
      };

      const mockUpdatedSubscription = {
        id: 'sub_test',
        status: 'active' as Stripe.Subscription.Status,
        items: {
          data: [
            {
              id: 'si_test',
              current_period_start: 1640000000,
              current_period_end: 1642592000,
            },
          ],
        },
      };

      vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue(
        mockRetrievedSubscription as any,
      );
      vi.mocked(mockStripe.subscriptions.update).mockResolvedValue(mockUpdatedSubscription as any);

      const result = await billingService.updateSubscription({
        subscriptionId: 'sub_test',
        priceId: 'price_new',
      });

      expect(result).toEqual({
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(1640000000 * 1000),
        currentPeriodEnd: new Date(1642592000 * 1000),
      });

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test', {
        items: [
          {
            id: 'si_test',
            price: 'price_new',
          },
        ],
        proration_behavior: 'create_prorations',
      });
    });

    it('should throw error when subscription has no items', async () => {
      vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_test',
        items: {
          data: [],
        },
      } as any);

      await expect(
        billingService.updateSubscription({
          subscriptionId: 'sub_test',
          priceId: 'price_new',
        }),
      ).rejects.toThrow('Subscription has no items to update');
    });

    it('should handle missing items property', async () => {
      vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_test',
        items: undefined,
      } as any);

      await expect(
        billingService.updateSubscription({
          subscriptionId: 'sub_test',
          priceId: 'price_new',
        }),
      ).rejects.toThrow('Subscription has no items to update');
    });

    it('should handle Stripe API errors', async () => {
      vi.mocked(mockStripe.subscriptions.retrieve).mockRejectedValue(
        new Error('Subscription not found'),
      );

      await expect(
        billingService.updateSubscription({
          subscriptionId: 'sub_invalid',
          priceId: 'price_new',
        }),
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      vi.mocked(mockStripe.subscriptions.cancel).mockResolvedValue({
        id: 'sub_test',
        status: 'canceled',
      } as any);

      await billingService.cancelSubscription('sub_test');

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test');
    });

    it('should handle Stripe API errors', async () => {
      vi.mocked(mockStripe.subscriptions.cancel).mockRejectedValue(
        new Error('Subscription not found'),
      );

      await expect(billingService.cancelSubscription('sub_invalid')).rejects.toThrow(
        'Subscription not found',
      );
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_test',
        status: 'active',
        customer: 'cus_test',
      };

      vi.mocked(mockStripe.subscriptions.retrieve).mockResolvedValue(mockSubscription as any);

      const result = await billingService.getSubscription('sub_test');

      expect(result).toEqual(mockSubscription);
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_test');
    });

    it('should return null for missing subscription', async () => {
      const stripeError = new Stripe.errors.StripeError({
        type: 'invalid_request_error',
        message: 'No such subscription',
      });
      (stripeError as any).code = 'resource_missing';

      vi.mocked(mockStripe.subscriptions.retrieve).mockRejectedValue(stripeError);

      const result = await billingService.getSubscription('sub_missing');

      expect(result).toBeNull();
    });

    it('should throw error for other Stripe errors', async () => {
      const stripeError = new Stripe.errors.StripeError({
        type: 'api_error',
        message: 'API error',
      });

      vi.mocked(mockStripe.subscriptions.retrieve).mockRejectedValue(stripeError);

      await expect(billingService.getSubscription('sub_test')).rejects.toThrow('API error');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session successfully', async () => {
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
      };

      vi.mocked(mockStripe.checkout.sessions.create).mockResolvedValue(mockSession as any);

      const result = await billingService.createCheckoutSession({
        customerId: 'cus_test',
        priceId: 'price_test',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      });

      expect(result).toEqual({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test',
        mode: 'subscription',
        line_items: [
          {
            price: 'price_test',
            quantity: 1,
          },
        ],
        success_url: 'https://app.example.com/success',
        cancel_url: 'https://app.example.com/cancel',
      });
    });

    it('should handle Stripe API errors', async () => {
      vi.mocked(mockStripe.checkout.sessions.create).mockRejectedValue(
        new Error('Invalid customer'),
      );

      await expect(
        billingService.createCheckoutSession({
          customerId: 'cus_invalid',
          priceId: 'price_test',
          successUrl: 'https://app.example.com/success',
          cancelUrl: 'https://app.example.com/cancel',
        }),
      ).rejects.toThrow('Invalid customer');
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session successfully', async () => {
      const mockSession = {
        url: 'https://billing.stripe.com/session/portal_test123',
      };

      vi.mocked(mockStripe.billingPortal.sessions.create).mockResolvedValue(mockSession as any);

      const result = await billingService.createPortalSession({
        customerId: 'cus_test',
        returnUrl: 'https://app.example.com/settings',
      });

      expect(result).toEqual({
        url: 'https://billing.stripe.com/session/portal_test123',
      });

      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test',
        return_url: 'https://app.example.com/settings',
      });
    });

    it('should handle Stripe API errors', async () => {
      vi.mocked(mockStripe.billingPortal.sessions.create).mockRejectedValue(
        new Error('Customer not found'),
      );

      await expect(
        billingService.createPortalSession({
          customerId: 'cus_invalid',
          returnUrl: 'https://app.example.com/settings',
        }),
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('getInvoices', () => {
    it('should retrieve invoices successfully', async () => {
      const mockInvoices = {
        data: [
          {
            id: 'in_test1',
            amount_due: 1000,
            status: 'paid',
          },
          {
            id: 'in_test2',
            amount_due: 2000,
            status: 'open',
          },
        ],
      };

      vi.mocked(mockStripe.invoices.list).mockResolvedValue(mockInvoices as any);

      const result = await billingService.getInvoices('cus_test');

      expect(result).toEqual(mockInvoices.data);
      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_test',
        limit: 10,
      });
    });

    it('should handle custom limit parameter', async () => {
      vi.mocked(mockStripe.invoices.list).mockResolvedValue({
        data: [],
      } as any);

      await billingService.getInvoices('cus_test', 25);

      expect(mockStripe.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_test',
        limit: 25,
      });
    });

    it('should handle Stripe API errors', async () => {
      vi.mocked(mockStripe.invoices.list).mockRejectedValue(new Error('Customer not found'));

      await expect(billingService.getInvoices('cus_invalid')).rejects.toThrow('Customer not found');
    });
  });

  describe('reportUsage', () => {
    it('should report usage successfully', async () => {
      const mockUsageRecord = {
        id: 'mbur_test',
        quantity: 100,
      };

      vi.mocked(mockStripe.subscriptionItems.createUsageRecord).mockResolvedValue(
        mockUsageRecord as any,
      );

      await billingService.reportUsage({
        subscriptionItemId: 'si_test',
        quantity: 100,
      });

      expect(mockStripe.subscriptionItems.createUsageRecord).toHaveBeenCalledWith('si_test', {
        quantity: 100,
        timestamp: expect.any(Number),
        action: 'increment',
      });
    });

    it('should round quantity to integer', async () => {
      vi.mocked(mockStripe.subscriptionItems.createUsageRecord).mockResolvedValue({} as any);

      await billingService.reportUsage({
        subscriptionItemId: 'si_test',
        quantity: 100.7,
      });

      expect(mockStripe.subscriptionItems.createUsageRecord).toHaveBeenCalledWith(
        'si_test',
        expect.objectContaining({
          quantity: 101,
        }),
      );
    });

    it('should use default timestamp when not provided', async () => {
      vi.mocked(mockStripe.subscriptionItems.createUsageRecord).mockResolvedValue({} as any);

      const beforeTime = Math.floor(Date.now() / 1000);
      await billingService.reportUsage({
        subscriptionItemId: 'si_test',
        quantity: 50,
      });
      const afterTime = Math.floor(Date.now() / 1000);

      const call = vi.mocked(mockStripe.subscriptionItems.createUsageRecord).mock.calls[0];
      const timestamp = call[1].timestamp as number;

      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should use custom timestamp when provided', async () => {
      vi.mocked(mockStripe.subscriptionItems.createUsageRecord).mockResolvedValue({} as any);

      const customTimestamp = 1640000000;
      await billingService.reportUsage({
        subscriptionItemId: 'si_test',
        quantity: 50,
        timestamp: customTimestamp,
      });

      expect(mockStripe.subscriptionItems.createUsageRecord).toHaveBeenCalledWith(
        'si_test',
        expect.objectContaining({
          timestamp: customTimestamp,
        }),
      );
    });

    it('should handle Stripe API errors', async () => {
      vi.mocked(mockStripe.subscriptionItems.createUsageRecord).mockRejectedValue(
        new Error('Subscription item not found'),
      );

      await expect(
        billingService.reportUsage({
          subscriptionItemId: 'si_invalid',
          quantity: 100,
        }),
      ).rejects.toThrow('Subscription item not found');
    });
  });
});
