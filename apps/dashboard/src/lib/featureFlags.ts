import React from 'react';
import { API_BASE_URL } from 'shared-ui';

/**
 * Simple in-memory cache for feature flags
 */
interface CacheEntry {
  value: boolean;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

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
    // Check cache first
    const cacheKey = `${key}:${userId || 'anonymous'}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.value;
    }

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
      const enabled = data.enabled || false;

      // Cache the result
      cache.set(cacheKey, { value: enabled, timestamp: Date.now() });

      return enabled;
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
    if (keys.length === 0) {
      return {};
    }

    // Check cache first and separate cached vs uncached keys
    const results: Record<string, boolean> = {};
    const uncachedKeys: string[] = [];

    for (const key of keys) {
      const cacheKey = `${key}:${userId || 'anonymous'}`;
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        results[key] = cached.value;
      } else {
        uncachedKeys.push(key);
      }
    }

    // If all keys are cached, return immediately
    if (uncachedKeys.length === 0) {
      return results;
    }

    // Fetch uncached flags using bulk endpoint
    try {
      const response = await fetch(`${API_BASE_URL}/feature-flags/check-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keys: uncachedKeys, userId }),
      });

      if (!response.ok) {
        console.error('Failed to check feature flags in bulk');
        // Return cached results + false for uncached
        uncachedKeys.forEach((key) => {
          results[key] = false;
        });
        return results;
      }

      const data = await response.json();
      const flagResults = data.data || {};

      // Cache results and merge with existing results
      for (const key of uncachedKeys) {
        const enabled = flagResults[key] || false;
        results[key] = enabled;

        // Cache the result
        const cacheKey = `${key}:${userId || 'anonymous'}`;
        cache.set(cacheKey, { value: enabled, timestamp: Date.now() });
      }

      return results;
    } catch (error) {
      console.error('Error checking feature flags in bulk', error);
      // Return cached results + false for uncached
      uncachedKeys.forEach((key) => {
        results[key] = false;
      });
      return results;
    }
  }

  /**
   * Clear the feature flag cache
   * Useful for testing or when you need to force a refresh
   */
  static clearCache(): void {
    cache.clear();
  }
}

/**
 * React hook for checking feature flags
 */
export function useFeatureFlag(
  key: string,
  userId?: string,
  options: { enabled?: boolean } = { enabled: true },
) {
  const [enabled, setEnabled] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!options.enabled) {
      setEnabled(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    FeatureFlagClient.isEnabled(key, userId)
      .then(setEnabled)
      .finally(() => setLoading(false));
  }, [key, userId, options.enabled]);

  return { enabled, loading };
}
