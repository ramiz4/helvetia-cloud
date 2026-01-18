import { PrivacyPolicyVersion, UserPrivacyPolicyAcceptance } from 'database';
import * as fs from 'fs/promises';
import * as path from 'path';
import { inject, injectable } from 'tsyringe';
import {
  AcceptPrivacyPolicyData,
  CreatePrivacyPolicyVersionData,
  IPrivacyPolicyRepository,
  UserPrivacyPolicyAcceptanceWithVersion,
} from '../interfaces';

/**
 * Service for managing Privacy Policy
 */
@injectable()
export class PrivacyPolicyService {
  constructor(
    @inject(Symbol.for('IPrivacyPolicyRepository'))
    private privacyPolicyRepository: IPrivacyPolicyRepository,
  ) {}

  /**
   * Get the latest version of privacy policy for a specific language
   */
  async getLatestPrivacyPolicy(language: string = 'en'): Promise<PrivacyPolicyVersion | null> {
    return this.privacyPolicyRepository.findLatestVersion(language);
  }

  /**
   * Get privacy policy by specific version and language
   */
  async getPrivacyPolicyByVersion(
    version: string,
    language: string = 'en',
  ): Promise<PrivacyPolicyVersion | null> {
    return this.privacyPolicyRepository.findByVersion(version, language);
  }

  /**
   * Get all versions of privacy policy for a specific language
   */
  async getAllVersions(language: string = 'en'): Promise<PrivacyPolicyVersion[]> {
    return this.privacyPolicyRepository.findAllVersions(language);
  }

  /**
   * Create a new version of privacy policy
   */
  async createPrivacyPolicyVersion(
    data: CreatePrivacyPolicyVersionData,
  ): Promise<PrivacyPolicyVersion> {
    // Validate that version doesn't already exist for this language
    const existing = await this.privacyPolicyRepository.findByVersion(data.version, data.language);
    if (existing) {
      throw new Error(
        `Privacy Policy version "${data.version}" already exists for language "${data.language}"`,
      );
    }

    return this.privacyPolicyRepository.createVersion(data);
  }

  /**
   * Load privacy policy content from markdown file
   */
  async loadPrivacyPolicyFromFile(version: string, language: string): Promise<string> {
    const privacyDir = path.join(__dirname, '../data/privacy');
    const filename = `v${version}-${language}.md`;
    const filePath = path.join(privacyDir, filename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch {
      throw new Error(`Failed to load privacy policy file: ${filename}`);
    }
  }

  /**
   * Initialize privacy policy from markdown files
   */
  async initializePrivacyPolicyFromFiles(version: string, effectiveAt: Date): Promise<void> {
    const languages = ['en', 'de', 'fr', 'it', 'gsw'];

    for (const language of languages) {
      // Check if version already exists
      const existing = await this.privacyPolicyRepository.findByVersion(version, language);
      if (existing) {
        console.log(`Privacy Policy version ${version} for ${language} already exists, skipping`);
        continue;
      }

      try {
        // Load content from file
        const content = await this.loadPrivacyPolicyFromFile(version, language);

        // Create privacy policy version in database
        await this.createPrivacyPolicyVersion({
          version,
          content,
          language,
          effectiveAt,
        });

        console.log(`Successfully initialized privacy policy version ${version} for ${language}`);
      } catch (error) {
        console.error(`Failed to initialize privacy policy for ${language}:`, error);
        throw error;
      }
    }
  }

  /**
   * Record user acceptance of privacy policy
   */
  async acceptPrivacyPolicy(data: AcceptPrivacyPolicyData): Promise<UserPrivacyPolicyAcceptance> {
    // Check if user has already accepted this version
    const existing = await this.privacyPolicyRepository.getUserAcceptance(
      data.userId,
      data.privacyPolicyVersionId,
    );
    if (existing) {
      return existing; // Already accepted, return existing record
    }

    return this.privacyPolicyRepository.createAcceptance(data);
  }

  /**
   * Check if user has accepted a specific privacy policy version
   */
  async hasUserAccepted(userId: string, privacyPolicyVersionId: string): Promise<boolean> {
    return this.privacyPolicyRepository.hasUserAcceptedVersion(userId, privacyPolicyVersionId);
  }

  /**
   * Check if user has accepted the latest privacy policy for a language
   */
  async hasUserAcceptedLatest(userId: string, language: string = 'en'): Promise<boolean> {
    const latestPolicy = await this.getLatestPrivacyPolicy(language);
    if (!latestPolicy) {
      return true; // No policy exists yet
    }

    return this.hasUserAccepted(userId, latestPolicy.id);
  }

  /**
   * Get user's latest acceptance record
   */
  async getUserLatestAcceptance(
    userId: string,
    language: string = 'en',
  ): Promise<UserPrivacyPolicyAcceptanceWithVersion | null> {
    return this.privacyPolicyRepository.getUserLatestAcceptance(userId, language);
  }

  /**
   * Check if user needs to accept new privacy policy
   */
  async requiresAcceptance(userId: string, language: string = 'en'): Promise<boolean> {
    const latestPolicy = await this.getLatestPrivacyPolicy(language);
    if (!latestPolicy) {
      return false; // No policy exists yet
    }

    const latestAcceptance = await this.getUserLatestAcceptance(userId, language);
    if (!latestAcceptance) {
      return true; // User has never accepted any policy
    }

    // Check if the latest policy is newer than what user accepted
    return latestPolicy.effectiveAt > latestAcceptance.privacyPolicy.effectiveAt;
  }
}
