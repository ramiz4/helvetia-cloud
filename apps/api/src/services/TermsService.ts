import { TermsVersion, UserTermsAcceptance } from 'database';
import * as fs from 'fs/promises';
import * as path from 'path';
import { inject, injectable } from 'tsyringe';
import {
  AcceptTermsData,
  CreateTermsVersionData,
  ITermsRepository,
  UserTermsAcceptanceWithVersion,
} from '../interfaces';

/**
 * Service for managing Terms of Service
 */
@injectable()
export class TermsService {
  constructor(
    @inject(Symbol.for('ITermsRepository'))
    private termsRepository: ITermsRepository,
  ) {}

  /**
   * Get the latest version of terms for a specific language
   */
  async getLatestTerms(language: string = 'en'): Promise<TermsVersion | null> {
    return this.termsRepository.findLatestVersion(language);
  }

  /**
   * Get terms by specific version and language
   */
  async getTermsByVersion(version: string, language: string = 'en'): Promise<TermsVersion | null> {
    return this.termsRepository.findByVersion(version, language);
  }

  /**
   * Get all versions of terms for a specific language
   */
  async getAllVersions(language: string = 'en'): Promise<TermsVersion[]> {
    return this.termsRepository.findAllVersions(language);
  }

  /**
   * Create a new version of terms
   */
  async createTermsVersion(data: CreateTermsVersionData): Promise<TermsVersion> {
    // Validate that version doesn't already exist for this language
    const existing = await this.termsRepository.findByVersion(data.version, data.language);
    if (existing) {
      throw new Error(
        `Terms version "${data.version}" already exists for language "${data.language}"`,
      );
    }

    return this.termsRepository.createVersion(data);
  }

  /**
   * Load terms content from markdown file
   */
  async loadTermsFromFile(version: string, language: string): Promise<string> {
    const termsDir = path.join(__dirname, '../data/terms');
    const filename = `v${version}-${language}.md`;
    const filePath = path.join(termsDir, filename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch {
      throw new Error(`Failed to load terms file: ${filename}`);
    }
  }

  /**
   * Initialize terms from markdown files
   * This should be called during application startup or migration
   */
  async initializeTermsFromFiles(version: string, effectiveAt: Date): Promise<void> {
    const languages = ['en', 'de', 'fr', 'it'];

    for (const language of languages) {
      // Check if version already exists
      const existing = await this.termsRepository.findByVersion(version, language);
      if (existing) {
        console.log(`Terms version ${version} for ${language} already exists, skipping`);
        continue;
      }

      try {
        // Load content from file
        const content = await this.loadTermsFromFile(version, language);

        // Create terms version in database
        await this.createTermsVersion({
          version,
          content,
          language,
          effectiveAt,
        });

        console.log(`Successfully initialized terms version ${version} for ${language}`);
      } catch (error) {
        console.error(`Failed to initialize terms for ${language}:`, error);
        throw error;
      }
    }
  }

  /**
   * Record user acceptance of terms
   */
  async acceptTerms(data: AcceptTermsData): Promise<UserTermsAcceptance> {
    // Check if user has already accepted this version
    const existing = await this.termsRepository.getUserAcceptance(data.userId, data.termsVersionId);
    if (existing) {
      return existing; // Already accepted, return existing record
    }

    return this.termsRepository.createAcceptance(data);
  }

  /**
   * Check if user has accepted a specific terms version
   */
  async hasUserAccepted(userId: string, termsVersionId: string): Promise<boolean> {
    return this.termsRepository.hasUserAcceptedVersion(userId, termsVersionId);
  }

  /**
   * Check if user has accepted the latest terms for a language
   */
  async hasUserAcceptedLatest(userId: string, language: string = 'en'): Promise<boolean> {
    const latestTerms = await this.getLatestTerms(language);
    if (!latestTerms) {
      return true; // No terms exist yet
    }

    return this.hasUserAccepted(userId, latestTerms.id);
  }

  /**
   * Get user's latest acceptance record
   */
  async getUserLatestAcceptance(
    userId: string,
    language: string = 'en',
  ): Promise<UserTermsAcceptanceWithVersion | null> {
    return this.termsRepository.getUserLatestAcceptance(userId, language);
  }

  /**
   * Check if user needs to accept new terms
   */
  async requiresAcceptance(userId: string, language: string = 'en'): Promise<boolean> {
    const latestTerms = await this.getLatestTerms(language);
    if (!latestTerms) {
      return false; // No terms exist yet
    }

    const latestAcceptance = await this.getUserLatestAcceptance(userId, language);
    if (!latestAcceptance) {
      return true; // User has never accepted any terms
    }

    // Check if the latest terms are newer than what user accepted
    return latestTerms.effectiveAt > latestAcceptance.termsVersion.effectiveAt;
  }
}
