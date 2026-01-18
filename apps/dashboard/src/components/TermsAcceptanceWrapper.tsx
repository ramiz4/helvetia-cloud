'use client';

import { PrivacyPolicyAcceptanceModal } from '@/components/PrivacyPolicyAcceptanceModal';
import { TermsAcceptanceModal } from '@/components/TermsAcceptanceModal';
import { usePrivacyAcceptance } from '@/hooks/usePrivacyAcceptance';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { useEffect, useState } from 'react';

interface TermsAcceptanceWrapperProps {
  children: React.ReactNode;
}

export function TermsAcceptanceWrapper({ children }: TermsAcceptanceWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const user = localStorage.getItem('user');
    setIsAuthenticated(!!user);
  }, []);

  // Fetch terms acceptance status
  const {
    data: termsStatus,
    isLoading: isTermsLoading,
    isError: isTermsError,
  } = useTermsAcceptance(isAuthenticated === true);

  // Fetch privacy acceptance status
  const {
    data: privacyStatus,
    isLoading: isPrivacyLoading,
    isError: isPrivacyError,
  } = usePrivacyAcceptance(isAuthenticated === true);

  // Manage modals
  useEffect(() => {
    if (!isAuthenticated) return;

    // Terms take precedence
    if (termsStatus?.requiresAcceptance && termsStatus?.latestTerms) {
      setShowTermsModal(true);
      setShowPrivacyModal(false);
    } else if (privacyStatus?.requiresAcceptance && privacyStatus?.latestPolicy) {
      // Only show privacy if terms are accepted (or don't need acceptance)
      setShowTermsModal(false);
      setShowPrivacyModal(true);
    } else {
      setShowTermsModal(false);
      setShowPrivacyModal(false);
    }
  }, [termsStatus, privacyStatus, isAuthenticated]);

  const handleTermsAccept = () => {
    setShowTermsModal(false);
    // The effect will run again and show privacy modal if needed
  };

  const handlePrivacyAccept = () => {
    setShowPrivacyModal(false);
  };

  const handleCancel = () => {
    // Logout user if they cancel
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setShowTermsModal(false);
    setShowPrivacyModal(false);
    window.location.href = '/login';
  };

  // Don't render anything while loading or if not authenticated (initial check)
  if (isTermsLoading || isPrivacyLoading || isTermsError || isPrivacyError || !isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {showTermsModal && termsStatus?.latestTerms && (
        <TermsAcceptanceModal
          terms={termsStatus.latestTerms}
          onAccept={handleTermsAccept}
          onCancel={handleCancel}
        />
      )}
      {showPrivacyModal && privacyStatus?.latestPolicy && (
        <PrivacyPolicyAcceptanceModal
          policy={privacyStatus.latestPolicy}
          onAccept={handlePrivacyAccept}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
