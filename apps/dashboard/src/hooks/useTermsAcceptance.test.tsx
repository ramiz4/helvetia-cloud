import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as sharedUi from 'shared-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAcceptTerms, useTermsAcceptance } from './useTermsAcceptance';

// Mock shared-ui module
vi.mock('shared-ui', () => ({
  API_BASE_URL: 'http://localhost:3001/api/v1',
  fetchWithAuth: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useTermsAcceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch terms acceptance status successfully', async () => {
    const mockData = {
      hasAccepted: false,
      currentVersion: '1.0.0',
      requiresAcceptance: true,
      latestTerms: {
        id: 'terms-1',
        version: '1.0.0',
        content: 'Test terms content',
        language: 'en',
        effectiveDate: '2024-01-01',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    };

    vi.mocked(sharedUi.fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as Response);

    const { result } = renderHook(() => useTermsAcceptance(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('should handle 401 unauthorized error', async () => {
    // Mock multiple times due to retry: 1 setting
    vi.mocked(sharedUi.fetchWithAuth).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useTermsAcceptance(true), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 3000 },
    );
    expect(result.current.error?.message).toBe('Unauthorized');
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(() => useTermsAcceptance(false), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(sharedUi.fetchWithAuth).not.toHaveBeenCalled();
  });
});

describe('useAcceptTerms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept terms successfully', async () => {
    vi.mocked(sharedUi.fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useAcceptTerms(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync('terms-1');

    expect(sharedUi.fetchWithAuth).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/terms/accept',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termsVersionId: 'terms-1' }),
      }),
    );
  });

  it('should handle acceptance error', async () => {
    vi.mocked(sharedUi.fetchWithAuth).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useAcceptTerms(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync('terms-1')).rejects.toThrow('HTTP error! status: 500');
  });
});
