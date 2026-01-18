export interface PrivacyPolicy {
  id: string;
  version: string;
  content: string;
  language: 'en' | 'de' | 'fr' | 'it' | 'gsw';
  effectiveAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyPolicyAcceptance {
  userId: string;
  policyId: string;
  version: string;
  acceptedAt: string;
}

export interface PrivacyPolicyAcceptanceStatus {
  hasAccepted: boolean;
  currentVersion: string;
  acceptedVersion?: string;
  requiresAcceptance: boolean;
  latestPolicy?: PrivacyPolicy;
}
