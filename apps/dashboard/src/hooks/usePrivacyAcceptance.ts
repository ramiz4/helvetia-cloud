'use client';

import type { PrivacyPolicyAcceptanceStatus } from '@/types/privacy';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, fetchWithAuth } from 'shared-ui';

// Query keys
export const privacyKeys = {
  all: ['privacy'] as const,
  acceptance: () => [...privacyKeys.all, 'acceptance'] as const,
  latest: (language: string) => [...privacyKeys.all, 'latest', language] as const,
};

// Fetch privacy policy acceptance status
async function fetchPrivacyAcceptanceStatus(): Promise<PrivacyPolicyAcceptanceStatus> {
  const response = await fetchWithAuth(`${API_BASE_URL}/privacy-policy/check-acceptance`);

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || 'Failed to fetch privacy acceptance status');
  }

  return {
    requiresAcceptance: json.data.requiresAcceptance,
    latestPolicy: json.data.latestVersion,
    hasAccepted: !json.data.requiresAcceptance,
    currentVersion: json.data.latestVersion?.version || '',
  };
}

// Accept privacy policy
async function acceptPrivacyPolicy(privacyPolicyVersionId: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/privacy-policy/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ privacyPolicyVersionId }),
  });

  if (!response.ok) {
    const json = await response.json();
    throw new Error(json.error || `HTTP error! status: ${response.status}`);
  }
}

// Hook: Check privacy policy acceptance status
export function usePrivacyAcceptance(enabled = true) {
  return useQuery({
    queryKey: privacyKeys.acceptance(),
    queryFn: fetchPrivacyAcceptanceStatus,
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook: Accept privacy policy
export function useAcceptPrivacy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptPrivacyPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: privacyKeys.acceptance() });
    },
  });
}
