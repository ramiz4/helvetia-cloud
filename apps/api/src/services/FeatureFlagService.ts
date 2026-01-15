import { inject, injectable } from 'tsyringe';
import {
  CreateFeatureFlagData,
  FeatureFlag,
  IFeatureFlagRepository,
  UpdateFeatureFlagData,
} from '../interfaces';

/**
 * Service for managing feature flags
 */
@injectable()
export class FeatureFlagService {
  constructor(
    @inject(Symbol.for('IFeatureFlagRepository'))
    private featureFlagRepository: IFeatureFlagRepository,
  ) {}

  /**
   * Get all feature flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    return this.featureFlagRepository.findAll();
  }

  /**
   * Get a feature flag by ID
   */
  async getFlagById(id: string): Promise<FeatureFlag | null> {
    return this.featureFlagRepository.findById(id);
  }

  /**
   * Get a feature flag by key
   */
  async getFlagByKey(key: string): Promise<FeatureFlag | null> {
    return this.featureFlagRepository.findByKey(key);
  }

  /**
   * Create a new feature flag
   */
  async createFlag(data: CreateFeatureFlagData): Promise<FeatureFlag> {
    // Validate that key doesn't already exist
    const existing = await this.featureFlagRepository.findByKey(data.key);
    if (existing) {
      throw new Error(`Feature flag with key "${data.key}" already exists`);
    }

    return this.featureFlagRepository.create(data);
  }

  /**
   * Update an existing feature flag
   */
  async updateFlag(id: string, data: UpdateFeatureFlagData): Promise<FeatureFlag> {
    const existing = await this.featureFlagRepository.findById(id);
    if (!existing) {
      throw new Error(`Feature flag with id "${id}" not found`);
    }

    return this.featureFlagRepository.update(id, data);
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(id: string): Promise<void> {
    const existing = await this.featureFlagRepository.findById(id);
    if (!existing) {
      throw new Error(`Feature flag with id "${id}" not found`);
    }

    return this.featureFlagRepository.delete(id);
  }

  /**
   * Check if a feature flag is enabled for a specific user
   * Supports A/B testing based on segments
   */
  async isEnabled(key: string, userId?: string): Promise<boolean> {
    return this.featureFlagRepository.isEnabled(key, userId);
  }

  /**
   * Check multiple feature flags at once
   * More efficient than checking one by one
   */
  async checkMultiple(keys: string[], userId?: string): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      keys.map(async (key) => {
        results[key] = await this.featureFlagRepository.isEnabled(key, userId);
      }),
    );

    return results;
  }

  /**
   * Toggle a feature flag on/off
   */
  async toggleFlag(id: string): Promise<FeatureFlag> {
    const existing = await this.featureFlagRepository.findById(id);
    if (!existing) {
      throw new Error(`Feature flag with id "${id}" not found`);
    }

    return this.featureFlagRepository.update(id, {
      enabled: !existing.enabled,
    });
  }
}
