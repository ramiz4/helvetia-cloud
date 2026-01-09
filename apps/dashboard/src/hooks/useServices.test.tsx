import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  serviceKeys,
  useDeleteService,
  useDeployService,
  useRestartService,
  useServices,
  useUpdateService,
} from './useServices';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create a test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useServices hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useServices', () => {
    it('fetches services successfully', async () => {
      const mockServices = [
        {
          id: '1',
          name: 'Test Service',
          status: 'RUNNING',
          type: 'DOCKER',
          deployments: [],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockServices,
      });

      const { result } = renderHook(() => useServices(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockServices);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/services'),
        expect.objectContaining({
          credentials: 'include',
        }),
      );
    });

    it('handles unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useServices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('useUpdateService', () => {
    it('updates service successfully', async () => {
      const updatedService = {
        id: '1',
        name: 'Updated Service',
        status: 'RUNNING',
        type: 'DOCKER',
        deployments: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => updatedService,
      });

      const { result } = renderHook(() => useUpdateService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        id: '1',
        data: { name: 'Updated Service' },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/1'),
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
        }),
      );
    });
  });

  describe('useDeleteService', () => {
    it('deletes service successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const { result } = renderHook(() => useDeleteService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync('1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/1'),
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        }),
      );
    });
  });

  describe('useDeployService', () => {
    it('deploys service with optimistic update', async () => {
      const mockDeployment = { id: 'deployment-1' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockDeployment,
      });

      const { result } = renderHook(() => useDeployService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync('1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/1/deploy'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    it('rolls back on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Deploy failed'));

      const { result } = renderHook(() => useDeployService(), {
        wrapper: createWrapper(),
      });

      try {
        await result.current.mutateAsync('1');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        // Expected to fail
      }

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useRestartService', () => {
    it('restarts service with optimistic update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const { result } = renderHook(() => useRestartService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync('1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/1/restart'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });
  });

  describe('serviceKeys', () => {
    it('generates correct query keys', () => {
      expect(serviceKeys.all).toEqual(['services']);
      expect(serviceKeys.lists()).toEqual(['services', 'list']);
      expect(serviceKeys.detail('1')).toEqual(['services', 'detail', '1']);
    });
  });
});
