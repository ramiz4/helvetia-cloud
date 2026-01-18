import { TermsVersion, UserTermsAcceptance } from 'database';

export interface CreateTermsVersionData {
  version: string;
  content: string;
  language: string;
  effectiveAt: Date;
}

export interface AcceptTermsData {
  userId: string;
  termsVersionId: string;
  ipAddress?: string;
  userAgent?: string;
}

export type UserTermsAcceptanceWithVersion = UserTermsAcceptance & {
  termsVersion: TermsVersion;
};

export interface ITermsRepository {
  findLatestVersion(language: string): Promise<TermsVersion | null>;
  findByVersion(version: string, language: string): Promise<TermsVersion | null>;
  findAllVersions(language: string): Promise<TermsVersion[]>;
  createVersion(data: CreateTermsVersionData): Promise<TermsVersion>;
  getUserAcceptance(userId: string, termsVersionId: string): Promise<UserTermsAcceptance | null>;
  getUserLatestAcceptance(
    userId: string,
    language: string,
  ): Promise<UserTermsAcceptanceWithVersion | null>;
  createAcceptance(data: AcceptTermsData): Promise<UserTermsAcceptance>;
  hasUserAcceptedVersion(userId: string, termsVersionId: string): Promise<boolean>;
}
