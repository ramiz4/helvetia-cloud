import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testServices, testSubscriptions, testUsers } from '../test/fixtures/billing.fixtures';
import { createMockInvoice } from '../test/mocks/stripe.mock';
import { BillingController } from './BillingController';

// Mock env module
vi.mock('../config/env', () => ({
  env: {
    PLATFORM_DOMAIN: 'helvetia.cloud',
    APP_BASE_URL: 'http://localhost:3000',
  },
}));

describe('BillingController', () => {
  let controller: BillingController;
  let mockBillingService: any;
  let mockSubscriptionService: any;
  let mockUsageTrackingService: any;
  let mockUserRepository: any;
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    // Mock services
    mockBillingService = {
      getOrCreateCustomer: vi.fn(),
      createCheckoutSession: vi.fn(),
      createPortalSession: vi.fn(),
      getInvoices: vi.fn(),
    };

    mockSubscriptionService = {
      getSubscription: vi.fn(),
    };

    mockUsageTrackingService = {
      getAggregatedUsage: vi.fn(),
      getServiceUsage: vi.fn(),
    };

    mockUserRepository = {
      findById: vi.fn(),
    };

    // Mock Fastify request and reply
    mockRequest = {
      user: { id: 'user-1' },
      body: {},
      query: {},
      params: {},
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
    controller = new BillingController(
      mockBillingService,
      mockSubscriptionService,
      mockUsageTrackingService,
      mockUserRepository,
    );
  });

  describe('getSubscription', () => {
    it('should return subscription for authenticated user', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(testSubscriptions.starter);

      const result = await controller.getSubscription(mockRequest, mockReply);

      expect(result).toEqual(testSubscriptions.starter);
      expect(mockSubscriptionService.getSubscription).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.getSubscription(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 404 if subscription not found', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(null);

      await controller.getSubscription(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'No subscription found' });
    });

    it('should return 500 on service error', async () => {
      mockSubscriptionService.getSubscription.mockRejectedValue(new Error('Database error'));

      await controller.getSubscription(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Failed to get subscription' });
      expect(mockRequest.log.error).toHaveBeenCalled();
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session successfully', async () => {
      mockRequest.body = { priceId: 'price_starter', plan: 'STARTER' };
      mockUserRepository.findById.mockResolvedValue(testUsers.user1);
      mockBillingService.getOrCreateCustomer.mockResolvedValue('cus_test123');
      mockBillingService.createCheckoutSession.mockResolvedValue({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
      });

      const result = await controller.createCheckoutSession(mockRequest, mockReply);

      expect(result).toEqual({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
      });

      expect(mockBillingService.getOrCreateCustomer).toHaveBeenCalledWith({
        userId: 'user-1',
        email: expect.stringContaining('@noreply.'),
        name: testUsers.user1.username,
      });

      expect(mockBillingService.createCheckoutSession).toHaveBeenCalledWith({
        customerId: 'cus_test123',
        priceId: 'price_starter',
        successUrl: expect.stringContaining('/billing/success'),
        cancelUrl: expect.stringContaining('/billing'),
      });
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.createCheckoutSession(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 400 if priceId missing', async () => {
      mockRequest.body = { plan: 'STARTER' };

      await controller.createCheckoutSession(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'priceId and plan are required' });
    });

    it('should return 400 if plan missing', async () => {
      mockRequest.body = { priceId: 'price_starter' };

      await controller.createCheckoutSession(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'priceId and plan are required' });
    });

    it('should return 404 if user not found', async () => {
      mockRequest.body = { priceId: 'price_starter', plan: 'STARTER' };
      mockUserRepository.findById.mockResolvedValue(null);

      await controller.createCheckoutSession(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('should return 500 on service error', async () => {
      mockRequest.body = { priceId: 'price_starter', plan: 'STARTER' };
      mockUserRepository.findById.mockResolvedValue(testUsers.user1);
      mockBillingService.getOrCreateCustomer.mockRejectedValue(new Error('Stripe error'));

      await controller.createCheckoutSession(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Failed to create checkout session' });
      expect(mockRequest.log.error).toHaveBeenCalled();
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session successfully', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(testSubscriptions.starter);
      mockBillingService.createPortalSession.mockResolvedValue({
        url: 'https://billing.stripe.com/test',
      });

      const result = await controller.createPortalSession(mockRequest, mockReply);

      expect(result).toEqual({ url: 'https://billing.stripe.com/test' });

      expect(mockBillingService.createPortalSession).toHaveBeenCalledWith({
        customerId: testSubscriptions.starter.stripeCustomerId,
        returnUrl: expect.stringContaining('/billing'),
      });
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.createPortalSession(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 404 if subscription not found', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(null);

      await controller.createPortalSession(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'No subscription found' });
    });

    it('should return 500 on service error', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(testSubscriptions.starter);
      mockBillingService.createPortalSession.mockRejectedValue(new Error('Stripe error'));

      await controller.createPortalSession(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Failed to create portal session' });
      expect(mockRequest.log.error).toHaveBeenCalled();
    });
  });

  describe('getInvoices', () => {
    it('should return invoices for user', async () => {
      const mockInvoices = [createMockInvoice({ id: 'in_1' }), createMockInvoice({ id: 'in_2' })];
      mockSubscriptionService.getSubscription.mockResolvedValue(testSubscriptions.starter);
      mockBillingService.getInvoices.mockResolvedValue(mockInvoices);

      const result = await controller.getInvoices(mockRequest, mockReply);

      expect(result).toEqual({ invoices: mockInvoices });
      expect(mockBillingService.getInvoices).toHaveBeenCalledWith(
        testSubscriptions.starter.stripeCustomerId,
      );
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.getInvoices(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 404 if subscription not found', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(null);

      await controller.getInvoices(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'No subscription found' });
    });

    it('should return 500 on service error', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(testSubscriptions.starter);
      mockBillingService.getInvoices.mockRejectedValue(new Error('Stripe error'));

      await controller.getInvoices(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Failed to get invoices' });
      expect(mockRequest.log.error).toHaveBeenCalled();
    });
  });

  describe('getUsage', () => {
    it('should return usage for current billing period', async () => {
      const mockUsage = [
        { metric: 'COMPUTE_HOURS', quantity: 100, cost: 1.0 },
        { metric: 'MEMORY_GB_HOURS', quantity: 50, cost: 0.25 },
      ];

      mockSubscriptionService.getSubscription.mockResolvedValue(testSubscriptions.starter);
      mockUsageTrackingService.getAggregatedUsage.mockResolvedValue(mockUsage);

      const result = await controller.getUsage(mockRequest, mockReply);

      expect(result).toEqual({
        usage: mockUsage,
        periodStart: testSubscriptions.starter.currentPeriodStart,
        periodEnd: testSubscriptions.starter.currentPeriodEnd,
      });

      expect(mockUsageTrackingService.getAggregatedUsage).toHaveBeenCalledWith({
        userId: 'user-1',
        periodStart: testSubscriptions.starter.currentPeriodStart,
        periodEnd: testSubscriptions.starter.currentPeriodEnd,
      });
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.getUsage(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 404 if subscription not found', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(null);

      await controller.getUsage(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'No subscription found' });
    });

    it('should return 500 on service error', async () => {
      mockSubscriptionService.getSubscription.mockResolvedValue(testSubscriptions.starter);
      mockUsageTrackingService.getAggregatedUsage.mockRejectedValue(new Error('Database error'));

      await controller.getUsage(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Failed to get usage' });
      expect(mockRequest.log.error).toHaveBeenCalled();
    });
  });

  describe('getUsageHistory', () => {
    it('should return usage for custom date range', async () => {
      mockRequest.query = {
        periodStart: '2024-01-01T00:00:00.000Z',
        periodEnd: '2024-01-31T23:59:59.999Z',
      };

      const mockUsage = [{ metric: 'COMPUTE_HOURS', quantity: 100, cost: 1.0 }];
      mockUsageTrackingService.getAggregatedUsage.mockResolvedValue(mockUsage);

      const result = await controller.getUsageHistory(mockRequest, mockReply);

      expect(result).toEqual({
        usage: mockUsage,
        periodStart: new Date('2024-01-01T00:00:00.000Z'),
        periodEnd: new Date('2024-01-31T23:59:59.999Z'),
      });
    });

    it('should use default date range if not provided', async () => {
      mockUsageTrackingService.getAggregatedUsage.mockResolvedValue([]);

      const result = await controller.getUsageHistory(mockRequest, mockReply);

      expect(result).toHaveProperty('periodStart');
      expect(result).toHaveProperty('periodEnd');
      expect(result.usage).toEqual([]);
    });

    it('should return 400 for invalid date format', async () => {
      mockRequest.query = { periodStart: 'invalid-date' };

      await controller.getUsageHistory(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Invalid periodStart date format' });
    });

    it('should return 400 if periodStart is after periodEnd', async () => {
      mockRequest.query = {
        periodStart: '2024-02-01T00:00:00.000Z',
        periodEnd: '2024-01-01T00:00:00.000Z',
      };

      await controller.getUsageHistory(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'periodStart must be before periodEnd',
      });
    });

    it('should return 400 if date range exceeds 1 year', async () => {
      mockRequest.query = {
        periodStart: '2023-01-01T00:00:00.000Z',
        periodEnd: '2024-02-01T00:00:00.000Z',
      };

      await controller.getUsageHistory(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Date range cannot exceed 1 year' });
    });

    it('should return 400 for future dates', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      mockRequest.query = {
        periodEnd: futureDate.toISOString(),
      };

      await controller.getUsageHistory(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'periodEnd cannot be in the future' });
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;

      await controller.getUsageHistory(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('getServiceUsage', () => {
    it('should return usage for a specific service', async () => {
      mockRequest.params = { id: 'service-1' };
      mockRequest.query = {
        periodStart: '2024-01-01T00:00:00.000Z',
        periodEnd: '2024-01-31T23:59:59.999Z',
      };

      // Mock the dynamic prisma import
      vi.doMock('database', () => ({
        prisma: {
          service: {
            findUnique: vi.fn().mockResolvedValue({
              ...testServices.service1,
              userId: 'user-1',
              environment: null,
            }),
          },
        },
      }));

      const mockUsage = [{ metric: 'COMPUTE_HOURS', quantity: 50 }];
      mockUsageTrackingService.getServiceUsage.mockResolvedValue(mockUsage);

      const result = await controller.getServiceUsage(mockRequest, mockReply);

      expect(result).toEqual({
        usage: mockUsage,
        periodStart: new Date('2024-01-01T00:00:00.000Z'),
        periodEnd: new Date('2024-01-31T23:59:59.999Z'),
        serviceId: 'service-1',
        serviceName: expect.any(String),
      });
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: 'service-1' };

      await controller.getServiceUsage(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 400 for invalid date format', async () => {
      mockRequest.params = { id: 'service-1' };
      mockRequest.query = { periodStart: 'invalid-date' };

      await controller.getServiceUsage(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Invalid periodStart date format' });
    });

    it('should return 400 if date range exceeds 1 year', async () => {
      mockRequest.params = { id: 'service-1' };
      mockRequest.query = {
        periodStart: '2023-01-01T00:00:00.000Z',
        periodEnd: '2024-02-01T00:00:00.000Z',
      };

      await controller.getServiceUsage(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Date range cannot exceed 1 year' });
    });
  });
});
