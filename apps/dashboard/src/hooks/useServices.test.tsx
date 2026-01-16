import { Service } from '@/types/service';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUpdateServiceMetrics,
  serviceKeys,
  useDeleteService,
  useDeployService,
  useRestartService,
  useService,
  useServices,
  useStopService,
  useUpdateService,
} from './useServices';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create a test wrapper with QueryClient
function createWrapper(client?: QueryClient) {
  const queryClient =
    client ||
    new QueryClient({
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

    it('handles error when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      });

      const { result } = renderHook(() => useServices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
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

  describe('useService', () => {
    it('fetches single service successfully', async () => {
      const mockService = { id: '1', name: 'Test Service' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockService,
      });

      const { result } = renderHook(() => useService('1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockService);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/1'),
        expect.anything(),
      );
    });

    it('handles fetch single service error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' }),
      });

      const { result } = renderHook(() => useService('1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
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

    it('handles update service error', async () => {
      // Mock failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
      });

      const { result } = renderHook(() => useUpdateService(), { wrapper: createWrapper() });

      await expect(result.current.mutateAsync({ id: '1', data: {} })).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));
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

    it('handles delete service error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {},
      });

      const { result } = renderHook(() => useDeleteService(), { wrapper: createWrapper() });

      await expect(result.current.mutateAsync('1')).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));
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

    it('rolls back on error (network)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Deploy failed'));

      const { result } = renderHook(() => useDeployService(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync('1')).rejects.toThrow('Deploy failed');

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('handles deploy service http error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad Request' }),
      });

      const { result } = renderHook(() => useDeployService(), { wrapper: createWrapper() });

      await expect(result.current.mutateAsync('1')).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useRestartService', () => {
    it('restarts service with optimistic update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Container restarted successfully',
          containerName: 'new-container',
        }),
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

    it('handles restart service error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {},
      });

      const { result } = renderHook(() => useRestartService(), { wrapper: createWrapper() });

      await expect(result.current.mutateAsync('1')).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useStopService', () => {
    it('stops service with optimistic update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const { result } = renderHook(() => useStopService(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync('1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/services/1/stop'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('handles stop service error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {},
      });

      const { result } = renderHook(() => useStopService(), { wrapper: createWrapper() });

      await expect(result.current.mutateAsync('1')).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('createUpdateServiceMetrics', () => {
    it('updates services in cache', () => {
      const queryClient = new QueryClient();
      const initialServices: Service[] = [
        {
          id: '1',
          name: 'test',
          status: 'RUNNING',
          metrics: {
            cpu: 1,
            memory: 10,
            memoryLimit: 1024,
            status: 'RUNNING',
          },
          deployments: [],
          repoUrl: '',
          branch: '',
          buildCommand: '',
          startCommand: '',
          port: 0,
          type: 'DOCKER',
          createdAt: '',
        },
      ];
      queryClient.setQueryData(serviceKeys.lists(), initialServices);

      const updater = createUpdateServiceMetrics(queryClient);
      updater([
        {
          id: '1',
          metrics: {
            cpu: 50,
            memory: 500,
            memoryLimit: 1024,
            status: 'RUNNING',
          },
          status: 'RUNNING',
        },
      ]);

      const updatedServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());
      expect(updatedServices![0].metrics?.cpu).toBe(50);
      expect(updatedServices![0].metrics?.memory).toBe(500);
    });

    it('ignores updates for unknown services', () => {
      const queryClient = new QueryClient();
      const initialServices: Service[] = [
        {
          id: '1',
          name: 'test',
          status: 'RUNNING',
          metrics: {
            cpu: 1,
            memory: 10,
            memoryLimit: 1024,
            status: 'RUNNING',
          },
          deployments: [],
          repoUrl: '',
          branch: '',
          buildCommand: '',
          startCommand: '',
          port: 0,
          type: 'DOCKER',
          createdAt: '',
        },
      ];
      queryClient.setQueryData(serviceKeys.lists(), initialServices);

      const updater = createUpdateServiceMetrics(queryClient);
      updater([
        {
          id: '2',
          metrics: {
            cpu: 50,
            memory: 500,
            memoryLimit: 1024,
            status: 'RUNNING',
          },
          status: 'RUNNING',
        },
      ]);

      const updatedServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());
      expect(updatedServices).toEqual(initialServices);
    });

    it('validates status and updates with valid ServiceStatus value', () => {
      const queryClient = new QueryClient();
      const initialServices: Service[] = [
        {
          id: '1',
          name: 'test',
          status: 'RUNNING',
          metrics: { cpu: 1, memory: 10, memoryLimit: 1024, status: 'RUNNING' },
          deployments: [],
          repoUrl: '',
          branch: '',
          buildCommand: '',
          startCommand: '',
          port: 0,
          type: 'DOCKER',
          createdAt: '',
        },
      ];
      queryClient.setQueryData(serviceKeys.lists(), initialServices);

      const updater = createUpdateServiceMetrics(queryClient);
      updater([
        {
          id: '1',
          metrics: { cpu: 50, memory: 500, memoryLimit: 1024, status: 'DEPLOYING' },
        },
      ]);

      const updatedServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());
      expect(updatedServices![0].status).toBe('DEPLOYING');
      expect(updatedServices![0].metrics?.status).toBe('DEPLOYING');
    });

    it('falls back to current status when metrics.status is invalid', () => {
      const queryClient = new QueryClient();
      const initialServices: Service[] = [
        {
          id: '1',
          name: 'test',
          status: 'RUNNING',
          metrics: { cpu: 1, memory: 10, memoryLimit: 1024, status: 'RUNNING' },
          deployments: [],
          repoUrl: '',
          branch: '',
          buildCommand: '',
          startCommand: '',
          port: 0,
          type: 'DOCKER',
          createdAt: '',
        },
      ];
      queryClient.setQueryData(serviceKeys.lists(), initialServices);

      const updater = createUpdateServiceMetrics(queryClient);
      updater([
        {
          id: '1',
          metrics: { cpu: 50, memory: 500, memoryLimit: 1024, status: 'INVALID_STATUS' },
        },
      ]);

      const updatedServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());
      expect(updatedServices![0].status).toBe('RUNNING'); // Should keep original status
      expect(updatedServices![0].metrics?.status).toBe('INVALID_STATUS'); // Metrics still updated
      expect(updatedServices![0].metrics?.cpu).toBe(50);
    });

    it('falls back to current status when metrics.status is undefined', () => {
      const queryClient = new QueryClient();
      const initialServices: Service[] = [
        {
          id: '1',
          name: 'test',
          status: 'STOPPED',
          metrics: { cpu: 1, memory: 10, memoryLimit: 1024 },
          deployments: [],
          repoUrl: '',
          branch: '',
          buildCommand: '',
          startCommand: '',
          port: 0,
          type: 'DOCKER',
          createdAt: '',
        },
      ];
      queryClient.setQueryData(serviceKeys.lists(), initialServices);

      const updater = createUpdateServiceMetrics(queryClient);
      updater([
        {
          id: '1',
          metrics: { cpu: 50, memory: 500, memoryLimit: 1024 },
        },
      ]);

      const updatedServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());
      expect(updatedServices![0].status).toBe('STOPPED'); // Should keep original status
      expect(updatedServices![0].metrics?.cpu).toBe(50);
      expect(updatedServices![0].metrics?.memory).toBe(500);
    });

    it('validates all valid ServiceStatus values', () => {
      const queryClient = new QueryClient();
      const validStatuses: ServiceStatus[] = [
        'IDLE',
        'RUNNING',
        'DEPLOYING',
        'FAILED',
        'NOT_RUNNING',
        'STOPPED',
        'CRASHING',
      ];

      validStatuses.forEach((validStatus) => {
        const initialServices: Service[] = [
          {
            id: '1',
            name: 'test',
            status: 'RUNNING',
            metrics: { cpu: 1, memory: 10, memoryLimit: 1024, status: 'RUNNING' },
            deployments: [],
            repoUrl: '',
            branch: '',
            buildCommand: '',
            startCommand: '',
            port: 0,
            type: 'DOCKER',
            createdAt: '',
          },
        ];
        queryClient.setQueryData(serviceKeys.lists(), initialServices);

        const updater = createUpdateServiceMetrics(queryClient);
        updater([
          {
            id: '1',
            metrics: { cpu: 50, memory: 500, memoryLimit: 1024, status: validStatus },
          },
        ]);

        const updatedServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());
        expect(updatedServices![0].status).toBe(validStatus);
      });
    });

    it('handles null status value gracefully', () => {
      const queryClient = new QueryClient();
      const initialServices: Service[] = [
        {
          id: '1',
          name: 'test',
          status: 'RUNNING',
          metrics: { cpu: 1, memory: 10, memoryLimit: 1024, status: 'RUNNING' },
          deployments: [],
          repoUrl: '',
          branch: '',
          buildCommand: '',
          startCommand: '',
          port: 0,
          type: 'DOCKER',
          createdAt: '',
        },
      ];
      queryClient.setQueryData(serviceKeys.lists(), initialServices);

      const updater = createUpdateServiceMetrics(queryClient);
      updater([
        {
          id: '1',
          metrics: { cpu: 50, memory: 500, memoryLimit: 1024, status: null as never },
        },
      ]);

      const updatedServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());
      expect(updatedServices![0].status).toBe('RUNNING'); // Should keep original status
      expect(updatedServices![0].metrics?.cpu).toBe(50);
    });

    it('handles IDLE status from backend correctly', () => {
      const queryClient = new QueryClient();
      const initialServices: Service[] = [
        {
          id: '1',
          name: 'test',
          status: 'STOPPED',
          metrics: { cpu: 0, memory: 0, memoryLimit: 1024, status: 'STOPPED' },
          deployments: [],
          repoUrl: '',
          branch: '',
          buildCommand: '',
          startCommand: '',
          port: 0,
          type: 'DOCKER',
          createdAt: '',
        },
      ];
      queryClient.setQueryData(serviceKeys.lists(), initialServices);

      const updater = createUpdateServiceMetrics(queryClient);
      updater([
        {
          id: '1',
          metrics: { cpu: 0, memory: 0, memoryLimit: 1024, status: 'IDLE' },
        },
      ]);

      const updatedServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());
      expect(updatedServices![0].status).toBe('IDLE');
      expect(updatedServices![0].metrics?.status).toBe('IDLE');
    });

    it('handles CRASHING status from backend correctly', () => {
      const queryClient = new QueryClient();
      const initialServices: Service[] = [
        {
          id: '1',
          name: 'test',
          status: 'RUNNING',
          metrics: { cpu: 10, memory: 100, memoryLimit: 1024, status: 'RUNNING' },
          deployments: [],
          repoUrl: '',
          branch: '',
          buildCommand: '',
          startCommand: '',
          port: 0,
          type: 'DOCKER',
          createdAt: '',
        },
      ];
      queryClient.setQueryData(serviceKeys.lists(), initialServices);

      const updater = createUpdateServiceMetrics(queryClient);
      updater([
        {
          id: '1',
          metrics: { cpu: 5, memory: 50, memoryLimit: 1024, status: 'CRASHING' },
        },
      ]);

      const updatedServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());
      expect(updatedServices![0].status).toBe('CRASHING');
      expect(updatedServices![0].metrics?.status).toBe('CRASHING');
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
