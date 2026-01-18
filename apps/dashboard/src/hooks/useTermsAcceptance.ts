'use client';

import type { TermsAcceptanceStatus } from '@/types/terms';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, fetchWithAuth } from 'shared-ui';

// Query keys
export const termsKeys = {
  all: ['terms'] as const,
  acceptance: () => [...termsKeys.all, 'acceptance'] as const,
  latest: (language: string) => [...termsKeys.all, 'latest', language] as const,
};

// Fetch terms acceptance status
async function fetchTermsAcceptanceStatus(): Promise<TermsAcceptanceStatus> {
  const response = await fetchWithAuth(`${API_BASE_URL}/terms/check-acceptance`);

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || 'Failed to fetch terms acceptance status');
  }

  return {
    requiresAcceptance: json.data.requiresAcceptance,
    latestTerms: json.data.latestVersion,
    hasAccepted: !json.data.requiresAcceptance,
    currentVersion: json.data.latestVersion?.version || '',
  };
}

// Accept terms
async function acceptTerms(termsVersionId: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/terms/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ termsVersionId }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}

// Hook: Check terms acceptance status
export function useTermsAcceptance(enabled = true) {
  return useQuery({
    queryKey: termsKeys.acceptance(),
    queryFn: fetchTermsAcceptanceStatus,
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook: Accept terms
export function useAcceptTerms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptTerms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: termsKeys.acceptance() });
    },
  });
}
