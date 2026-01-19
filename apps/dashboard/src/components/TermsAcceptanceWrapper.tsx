'use client';

import { PrivacyPolicyAcceptanceModal } from '@/components/PrivacyPolicyAcceptanceModal';
import { TermsAcceptanceModal } from '@/components/TermsAcceptanceModal';
import { usePrivacyAcceptance } from '@/hooks/usePrivacyAcceptance';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TermsAcceptanceWrapperProps {
  children: React.ReactNode;
}

export function TermsAcceptanceWrapper({ children }: TermsAcceptanceWrapperProps) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Check authentication on mount and route changes
  useEffect(() => {
    const checkAuth = () => {
      const user = localStorage.getItem('user');
      setIsAuthenticated(!!user);
    };

    checkAuth();

    // Re-check on storage changes (like logging out/in from another tab)
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, [pathname]);

  // Fetch terms acceptance status
  const { data: termsStatus } = useTermsAcceptance(isAuthenticated === true);

  // Fetch privacy acceptance status
  const { data: privacyStatus } = usePrivacyAcceptance(isAuthenticated === true);

  // Manage modals reactively during render for better responsiveness
  const currentRequiresTerms = !!(
    isAuthenticated &&
    termsStatus?.requiresAcceptance &&
    termsStatus?.latestTerms
  );
  const currentRequiresPrivacy = !!(
    isAuthenticated &&
    !currentRequiresTerms &&
    privacyStatus?.requiresAcceptance &&
    privacyStatus?.latestPolicy
  );

  // Still use useEffect for side effects if needed, but the render logic is now primary
  useEffect(() => {
    if (!isAuthenticated) {
      setShowTermsModal(false);
      setShowPrivacyModal(false);
      return;
    }

    setShowTermsModal(currentRequiresTerms);
    setShowPrivacyModal(currentRequiresPrivacy);
  }, [isAuthenticated, currentRequiresTerms, currentRequiresPrivacy]);

  const handleTermsAccept = () => {
    setShowTermsModal(false);
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
