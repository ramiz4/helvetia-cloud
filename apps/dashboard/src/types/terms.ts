export interface TermsOfService {
  id: string;
  version: string;
  content: string;
  language: 'en' | 'de' | 'fr' | 'it';
  effectiveDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface TermsAcceptance {
  userId: string;
  termsId: string;
  version: string;
  acceptedAt: string;
}

export interface TermsAcceptanceStatus {
  hasAccepted: boolean;
  currentVersion: string;
  acceptedVersion?: string;
  requiresAcceptance: boolean;
  latestTerms?: TermsOfService;
}
