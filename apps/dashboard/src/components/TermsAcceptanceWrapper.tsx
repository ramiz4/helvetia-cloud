'use client';

import { TermsAcceptanceModal } from '@/components/TermsAcceptanceModal';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { useEffect, useState } from 'react';

interface TermsAcceptanceWrapperProps {
  children: React.ReactNode;
}

export function TermsAcceptanceWrapper({ children }: TermsAcceptanceWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const user = localStorage.getItem('user');
    setIsAuthenticated(!!user);
  }, []);

  // Only fetch terms acceptance status if authenticated
  const {
    data: acceptanceStatus,
    isLoading,
    isError,
  } = useTermsAcceptance(isAuthenticated === true);

  // Show modal when user needs to accept terms
  useEffect(() => {
    if (acceptanceStatus?.requiresAcceptance && acceptanceStatus?.latestTerms && !showModal) {
      setShowModal(true);
    }
  }, [acceptanceStatus, showModal]);

  const handleAccept = () => {
    setShowModal(false);
  };

  const handleCancel = () => {
    // Logout user if they cancel
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setShowModal(false);
    window.location.href = '/login';
  };

  // Don't render anything while loading or if not authenticated
  if (isLoading || isError || !isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {showModal && acceptanceStatus?.latestTerms && (
        <TermsAcceptanceModal
          terms={acceptanceStatus.latestTerms}
          onAccept={handleAccept}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
