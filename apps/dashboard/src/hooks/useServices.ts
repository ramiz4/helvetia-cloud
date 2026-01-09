'use client';

import { API_BASE_URL } from '@/lib/config';
import type { Service, UpdateServiceData } from '@/types/service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Query keys
export const serviceKeys = {
  all: ['services'] as const,
  lists: () => [...serviceKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...serviceKeys.lists(), filters] as const,
  details: () => [...serviceKeys.all, 'detail'] as const,
  detail: (id: string) => [...serviceKeys.details(), id] as const,
};

// Fetch all services
async function fetchServices(): Promise<Service[]> {
  const response = await fetch(`${API_BASE_URL}/services`, {
    credentials: 'include',
  });

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Fetch single service
async function fetchService(id: string): Promise<Service> {
  const response = await fetch(`${API_BASE_URL}/services/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Update service
async function updateService(id: string, data: UpdateServiceData): Promise<Service> {
  const response = await fetch(`${API_BASE_URL}/services/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Delete service
async function deleteService(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/services/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}

// Deploy service
async function deployService(id: string): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE_URL}/services/${id}/deploy`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Restart service
async function restartService(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/services/${id}/restart`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to restart service');
  }
}

// Hook: Fetch all services
export function useServices() {
  return useQuery({
    queryKey: serviceKeys.lists(),
    queryFn: fetchServices,
  });
}

// Hook: Fetch single service
export function useService(id: string) {
  return useQuery({
    queryKey: serviceKeys.detail(id),
    queryFn: () => fetchService(id),
    enabled: !!id,
  });
}

// Hook: Update service
export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceData }) => updateService(id, data),
    onSuccess: (updatedService) => {
      // Update the service list cache
      queryClient.setQueryData<Service[]>(serviceKeys.lists(), (old) =>
        old ? old.map((s) => (s.id === updatedService.id ? updatedService : s)) : old,
      );
      // Update the individual service cache
      queryClient.setQueryData(serviceKeys.detail(updatedService.id), updatedService);
    },
  });
}

// Hook: Delete service
export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteService,
    onSuccess: (_, deletedId) => {
      // Remove from service list cache
      queryClient.setQueryData<Service[]>(serviceKeys.lists(), (old) =>
        old ? old.filter((s) => s.id !== deletedId) : old,
      );
      // Invalidate individual service cache
      queryClient.removeQueries({ queryKey: serviceKeys.detail(deletedId) });
    },
  });
}

// Hook: Deploy service
export function useDeployService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deployService,
    onMutate: async (serviceId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: serviceKeys.lists() });

      // Snapshot the previous value
      const previousServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());

      // Optimistically update to the new value
      queryClient.setQueryData<Service[]>(serviceKeys.lists(), (old) =>
        old ? old.map((s) => (s.id === serviceId ? { ...s, status: 'DEPLOYING' } : s)) : old,
      );

      return { previousServices };
    },
    onError: (_err, _serviceId, context) => {
      // Rollback to the previous value on error
      if (context?.previousServices) {
        queryClient.setQueryData(serviceKeys.lists(), context.previousServices);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

// Hook: Restart service
export function useRestartService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restartService,
    onMutate: async (serviceId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: serviceKeys.lists() });

      // Snapshot the previous value
      const previousServices = queryClient.getQueryData<Service[]>(serviceKeys.lists());

      // Optimistically update to the new value
      queryClient.setQueryData<Service[]>(serviceKeys.lists(), (old) =>
        old ? old.map((s) => (s.id === serviceId ? { ...s, status: 'DEPLOYING' } : s)) : old,
      );

      return { previousServices };
    },
    onError: (_err, _serviceId, context) => {
      // Rollback to the previous value on error
      if (context?.previousServices) {
        queryClient.setQueryData(serviceKeys.lists(), context.previousServices);
      }
    },
    onSettled: (_, __, serviceId) => {
      // Refetch specific service after restart
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

// Hook: Update service metrics (for real-time updates)
export function useUpdateServiceMetrics() {
  const queryClient = useQueryClient();

  return (updates: Array<{ id: string; metrics: Service['metrics']; status?: string }>) => {
    queryClient.setQueryData<Service[]>(serviceKeys.lists(), (old) =>
      old
        ? old.map((service) => {
            const update = updates.find((u) => u.id === service.id);
            if (update && update.metrics) {
              return {
                ...service,
                metrics: update.metrics,
                status: update.metrics.status || service.status,
              };
            }
            return service;
          })
        : old,
    );
  };
}
