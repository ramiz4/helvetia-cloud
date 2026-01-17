'use client';

import type { CheckoutSession, Invoice, PortalSession, Subscription, Usage } from '@/types/billing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, fetchWithAuth } from 'shared-ui';

// Query keys
export const billingKeys = {
  all: ['billing'] as const,
  subscription: () => [...billingKeys.all, 'subscription'] as const,
  invoices: () => [...billingKeys.all, 'invoices'] as const,
  usage: () => [...billingKeys.all, 'usage'] as const,
};

// Fetch current subscription
async function fetchSubscription(): Promise<Subscription | null> {
  const response = await fetchWithAuth(`${API_BASE_URL}/billing/subscription`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Fetch invoices
async function fetchInvoices(): Promise<Invoice[]> {
  const response = await fetchWithAuth(`${API_BASE_URL}/billing/invoices`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.invoices || [];
}

// Fetch usage
async function fetchUsage(): Promise<Usage> {
  const response = await fetchWithAuth(`${API_BASE_URL}/billing/usage`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Create checkout session
async function createCheckoutSession(priceId: string, plan: string): Promise<CheckoutSession> {
  const response = await fetchWithAuth(`${API_BASE_URL}/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ priceId, plan }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Create portal session
async function createPortalSession(): Promise<PortalSession> {
  const response = await fetchWithAuth(`${API_BASE_URL}/billing/portal`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Hook: Fetch subscription
export function useSubscription(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: fetchSubscription,
    retry: false,
    ...options,
  });
}

// Hook: Fetch invoices
export function useInvoices(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingKeys.invoices(),
    queryFn: fetchInvoices,
    ...options,
  });
}

// Hook: Fetch usage
export function useUsage(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingKeys.usage(),
    queryFn: fetchUsage,
    ...options,
  });
}

// Hook: Create checkout session
export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ priceId, plan }: { priceId: string; plan: string }) =>
      createCheckoutSession(priceId, plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription() });
    },
  });
}

// Hook: Create portal session
export function usePortal() {
  return useMutation({
    mutationFn: createPortalSession,
  });
}
