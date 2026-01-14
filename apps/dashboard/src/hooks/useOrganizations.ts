'use client';

import { getErrorMessage } from '@/lib/errorUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Organization, OrganizationMember, Role } from 'shared-ui';
import { API_BASE_URL, fetchWithAuth } from 'shared-ui';

export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  details: () => [...organizationKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationKeys.details(), id] as const,
};

async function fetchOrganizations(): Promise<Organization[]> {
  const response = await fetchWithAuth(`${API_BASE_URL}/organizations`);
  if (!response.ok) throw new Error(await getErrorMessage(response));
  return response.json();
}

async function fetchOrganization(id: string): Promise<Organization> {
  const response = await fetchWithAuth(`${API_BASE_URL}/organizations/${id}`);
  if (!response.ok) throw new Error(await getErrorMessage(response));
  return response.json();
}

async function createOrganization(name: string): Promise<Organization> {
  const response = await fetchWithAuth(`${API_BASE_URL}/organizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  return response.json();
}

async function addMember(orgId: string, userId: string, role: Role): Promise<OrganizationMember> {
  const response = await fetchWithAuth(`${API_BASE_URL}/organizations/${orgId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  return response.json();
}

async function updateMember(
  orgId: string,
  userId: string,
  role: Role,
): Promise<OrganizationMember> {
  const response = await fetchWithAuth(`${API_BASE_URL}/organizations/${orgId}/members/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response));
  return response.json();
}

async function removeMember(orgId: string, userId: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/organizations/${orgId}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(await getErrorMessage(response));
}

export function useOrganizations(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: fetchOrganizations,
    ...options,
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => fetchOrganization(id),
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
    },
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId, role }: { orgId: string; userId: string; role: Role }) =>
      addMember(orgId, userId, role),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(variables.orgId) });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId, role }: { orgId: string; userId: string; role: Role }) =>
      updateMember(orgId, userId, role),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(variables.orgId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) =>
      removeMember(orgId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(variables.orgId) });
    },
  });
}
