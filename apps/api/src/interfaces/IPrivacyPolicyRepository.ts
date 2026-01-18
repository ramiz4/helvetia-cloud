import { PrivacyPolicyVersion, UserPrivacyPolicyAcceptance } from 'database';

export interface CreatePrivacyPolicyVersionData {
  version: string;
  content: string;
  language: string;
  effectiveAt: Date;
}

export interface AcceptPrivacyPolicyData {
  userId: string;
  privacyPolicyVersionId: string;
  ipAddress?: string;
  userAgent?: string;
}

export type UserPrivacyPolicyAcceptanceWithVersion = UserPrivacyPolicyAcceptance & {
  privacyPolicy: PrivacyPolicyVersion;
};

export interface IPrivacyPolicyRepository {
  findLatestVersion(language: string): Promise<PrivacyPolicyVersion | null>;
  findByVersion(version: string, language: string): Promise<PrivacyPolicyVersion | null>;
  findAllVersions(language: string): Promise<PrivacyPolicyVersion[]>;
  createVersion(data: CreatePrivacyPolicyVersionData): Promise<PrivacyPolicyVersion>;
  getUserAcceptance(
    userId: string,
    privacyPolicyVersionId: string,
  ): Promise<UserPrivacyPolicyAcceptance | null>;
  getUserLatestAcceptance(
    userId: string,
    language: string,
  ): Promise<UserPrivacyPolicyAcceptanceWithVersion | null>;
  createAcceptance(data: AcceptPrivacyPolicyData): Promise<UserPrivacyPolicyAcceptance>;
  hasUserAcceptedVersion(userId: string, privacyPolicyVersionId: string): Promise<boolean>;
}
