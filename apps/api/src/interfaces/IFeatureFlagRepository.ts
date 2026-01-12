/**
 * FeatureFlag model type (matches Prisma schema)
 */
export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  segments: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data required to create a feature flag
 */
export interface CreateFeatureFlagData {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  segments?: unknown;
}

/**
 * Data for updating a feature flag
 */
export interface UpdateFeatureFlagData {
  name?: string;
  description?: string;
  enabled?: boolean;
  segments?: unknown;
}

/**
 * Repository interface for feature flag operations
 */
export interface IFeatureFlagRepository {
  /**
   * Find a feature flag by ID
   */
  findById(id: string): Promise<FeatureFlag | null>;

  /**
   * Find a feature flag by key
   */
  findByKey(key: string): Promise<FeatureFlag | null>;

  /**
   * Get all feature flags
   */
  findAll(): Promise<FeatureFlag[]>;

  /**
   * Create a new feature flag
   */
  create(data: CreateFeatureFlagData): Promise<FeatureFlag>;

  /**
   * Update an existing feature flag
   */
  update(id: string, data: UpdateFeatureFlagData): Promise<FeatureFlag>;

  /**
   * Delete a feature flag
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a feature flag is enabled
   * Supports A/B testing based on segments
   */
  isEnabled(key: string, userId?: string): Promise<boolean>;
}
