import type { CheckoutSession, Invoice, PortalSession, Subscription, Usage } from '@/types/billing';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  billingKeys,
  useCheckout,
  useInvoices,
  usePortal,
  useSubscription,
  useUsage,
} from './useBilling';

// Mock fetchWithAuth from shared-ui
vi.mock('shared-ui', () => ({
  API_BASE_URL: 'http://localhost:3001',
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from 'shared-ui';

describe('useBilling hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useSubscription', () => {
    it('should fetch subscription successfully', async () => {
      const mockSubscription: Subscription = {
        id: 'sub_123',
        plan: 'PRO',
        status: 'ACTIVE',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_stripe_123',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubscription,
      } as Response);

      const { result } = renderHook(() => useSubscription(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockSubscription);
      expect(fetchWithAuth).toHaveBeenCalledWith('http://localhost:3001/billing/subscription');
    });

    it('should handle subscription not found', async () => {
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'No subscription found' }),
      } as Response);

      const { result } = renderHook(() => useSubscription(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('useInvoices', () => {
    it('should fetch invoices successfully', async () => {
      const mockInvoices: Invoice[] = [
        {
          id: 'in_123',
          number: 'INV-001',
          status: 'paid',
          created: 1704067200,
          amount_due: 9900,
          amount_paid: 9900,
          currency: 'usd',
          hosted_invoice_url: 'https://stripe.com/invoice',
          invoice_pdf: 'https://stripe.com/invoice.pdf',
        },
      ];

      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoices: mockInvoices }),
      } as Response);

      const { result } = renderHook(() => useInvoices(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockInvoices);
      expect(fetchWithAuth).toHaveBeenCalledWith('http://localhost:3001/billing/invoices');
    });

    it('should handle empty invoices', async () => {
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invoices: [] }),
      } as Response);

      const { result } = renderHook(() => useInvoices(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });
  });

  describe('useUsage', () => {
    it('should fetch usage successfully', async () => {
      const mockUsage: Usage = {
        usage: [
          { metric: 'COMPUTE_HOURS', quantity: 10.5, cost: 5.25 },
          { metric: 'MEMORY_GB_HOURS', quantity: 50.0, cost: 10.0 },
        ],
        periodStart: '2024-01-01T00:00:00Z',
        periodEnd: '2024-02-01T00:00:00Z',
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsage,
      } as Response);

      const { result } = renderHook(() => useUsage(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockUsage);
      expect(fetchWithAuth).toHaveBeenCalledWith('http://localhost:3001/billing/usage');
    });
  });

  describe('billingKeys', () => {
    it('should generate correct query keys', () => {
      expect(billingKeys.all).toEqual(['billing']);
      expect(billingKeys.subscription()).toEqual(['billing', 'subscription']);
      expect(billingKeys.invoices()).toEqual(['billing', 'invoices']);
      expect(billingKeys.usage()).toEqual(['billing', 'usage']);
    });
  });

  describe('useCheckout', () => {
    it('should create checkout session successfully', async () => {
      const mockSession: CheckoutSession = {
        sessionId: 'cs_123',
        url: 'https://checkout.stripe.com/session/cs_123',
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession,
      } as Response);

      const { result } = renderHook(() => useCheckout(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ priceId: 'price_123', plan: 'PRO' });
      });

      expect(fetchWithAuth).toHaveBeenCalledWith('http://localhost:3001/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId: 'price_123', plan: 'PRO' }),
      });
    });

    it('should handle checkout session creation error', async () => {
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const { result } = renderHook(() => useCheckout(), { wrapper });

      await expect(async () => {
        await result.current.mutateAsync({ priceId: 'price_123', plan: 'PRO' });
      }).rejects.toThrow();
    });
  });

  describe('usePortal', () => {
    it('should create portal session successfully', async () => {
      const mockSession: PortalSession = {
        url: 'https://billing.stripe.com/session/bps_123',
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession,
      } as Response);

      const { result } = renderHook(() => usePortal(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(fetchWithAuth).toHaveBeenCalledWith('http://localhost:3001/billing/portal', {
        method: 'POST',
      });
    });

    it('should handle portal session creation error', async () => {
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const { result } = renderHook(() => usePortal(), { wrapper });

      await expect(async () => {
        await result.current.mutateAsync();
      }).rejects.toThrow();
    });
  });
});
