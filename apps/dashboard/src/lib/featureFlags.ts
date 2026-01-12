import React from 'react';
import { API_BASE_URL } from './config';

/**
 * Feature flag utility for checking if a feature is enabled
 * This is a client-side utility that calls the backend API
 */
export class FeatureFlagClient {
  /**
   * Check if a feature flag is enabled for a specific user
   * @param key - The feature flag key
   * @param userId - Optional user ID for A/B testing
   * @returns Promise<boolean> - Whether the flag is enabled
   */
  static async isEnabled(key: string, userId?: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/feature-flags/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, userId }),
      });

      if (!response.ok) {
        console.error(`Failed to check feature flag: ${key}`);
        return false;
      }

      const data = await response.json();
      return data.enabled || false;
    } catch (error) {
      console.error(`Error checking feature flag: ${key}`, error);
      return false;
    }
  }

  /**
   * Check multiple feature flags at once
   * @param keys - Array of feature flag keys
   * @param userId - Optional user ID for A/B testing
   * @returns Promise<Record<string, boolean>> - Map of flag keys to their enabled status
   */
  static async checkMultiple(keys: string[], userId?: string): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      keys.map(async (key) => {
        results[key] = await this.isEnabled(key, userId);
      }),
    );

    return results;
  }
}

/**
 * React hook for checking feature flags
 */
export function useFeatureFlag(key: string, userId?: string) {
  const [enabled, setEnabled] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    FeatureFlagClient.isEnabled(key, userId)
      .then(setEnabled)
      .finally(() => setLoading(false));
  }, [key, userId]);

  return { enabled, loading };
}
