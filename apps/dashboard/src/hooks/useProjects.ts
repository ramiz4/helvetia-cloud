'use client';

import type { Environment, Project } from '@/types/project';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, fetchWithAuth } from 'shared-ui';

// Query keys
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

// Fetch all projects
async function fetchProjects(organizationId?: string): Promise<Project[]> {
  const url = organizationId
    ? `${API_BASE_URL}/projects?organizationId=${organizationId}`
    : `${API_BASE_URL}/projects`;
  const response = await fetchWithAuth(url);

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Fetch single project
async function fetchProject(id: string): Promise<Project> {
  const response = await fetchWithAuth(`${API_BASE_URL}/projects/${id}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Create project
async function createProject(name: string, organizationId?: string): Promise<Project> {
  const response = await fetchWithAuth(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, organizationId }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Delete project
async function deleteProject(id: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
}

// Create environment
async function createEnvironment(projectId: string, name: string): Promise<Environment> {
  const response = await fetchWithAuth(`${API_BASE_URL}/projects/${projectId}/environments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Hook: Fetch all projects
export function useProjects(organizationId?: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: projectKeys.list({ organizationId }),
    queryFn: () => fetchProjects(organizationId),
    ...options,
  });
}

// Hook: Fetch single project
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });
}

// Hook: Create project
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, organizationId }: { name: string; organizationId?: string }) =>
      createProject(name, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

// Hook: Delete project
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

// Hook: Create environment
export function useCreateEnvironment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      createEnvironment(projectId, name),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}
