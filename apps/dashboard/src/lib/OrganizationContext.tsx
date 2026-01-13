'use client';

import { useOrganizations } from '@/hooks/useOrganizations';
import type { Organization } from '@/types/organization';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface OrganizationContextType {
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization) => void;
  organizations?: Organization[];
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    setUser(localStorage.getItem('user'));

    // Listen for storage events to update auth state
    const handleStorage = () => setUser(localStorage.getItem('user'));
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const { data: organizations, isLoading } = useOrganizations({ enabled: !!user });
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);

  useEffect(() => {
    if (organizations && organizations.length > 0) {
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      const savedOrg = organizations.find((o) => o.id === savedOrgId);

      if (savedOrg) {
        setCurrentOrg(savedOrg);
      } else {
        setCurrentOrg(organizations[0]);
        localStorage.setItem('currentOrganizationId', organizations[0].id);
      }
    }
  }, [organizations]);

  const handleSetCurrentOrg = (org: Organization) => {
    setCurrentOrg(org);
    localStorage.setItem('currentOrganizationId', org.id);
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization: currentOrg,
        setCurrentOrganization: handleSetCurrentOrg,
        isLoading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider');
  }
  return context;
}
