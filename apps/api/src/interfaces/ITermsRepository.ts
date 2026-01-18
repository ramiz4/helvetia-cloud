import { TermsVersion, UserTermsAcceptance } from '@prisma/client';

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

export interface ITermsRepository {
  findLatestVersion(language: string): Promise<TermsVersion | null>;
  findByVersion(version: string, language: string): Promise<TermsVersion | null>;
  findAllVersions(language: string): Promise<TermsVersion[]>;
  createVersion(data: CreateTermsVersionData): Promise<TermsVersion>;
  getUserAcceptance(userId: string, termsVersionId: string): Promise<UserTermsAcceptance | null>;
  getUserLatestAcceptance(userId: string, language: string): Promise<UserTermsAcceptance | null>;
  createAcceptance(data: AcceptTermsData): Promise<UserTermsAcceptance>;
  hasUserAcceptedVersion(userId: string, termsVersionId: string): Promise<boolean>;
}
