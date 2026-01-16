import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagClient, useFeatureFlag } from './featureFlags';

// Mock shared-ui module
vi.mock('shared-ui', () => ({
  API_BASE_URL: 'http://localhost:3001/api/v1',
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('FeatureFlagClient', () => {
  beforeEach(() => {
    // Clear cache before each test
    FeatureFlagClient.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    FeatureFlagClient.clearCache();
  });

  describe('isEnabled', () => {
    it('should return true when flag is enabled', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      const result = await FeatureFlagClient.isEnabled('test-flag');

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/feature-flags/check'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ key: 'test-flag', userId: undefined }),
        }),
      );
    });

    it('should return false when flag is disabled', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: false }),
      } as Response);

      const result = await FeatureFlagClient.isEnabled('test-flag');

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
      } as Response);

      const result = await FeatureFlagClient.isEnabled('test-flag');

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await FeatureFlagClient.isEnabled('test-flag');

      expect(result).toBe(false);
    });

    it('should cache results for subsequent calls', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      // First call
      const result1 = await FeatureFlagClient.isEnabled('test-flag');
      expect(result1).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await FeatureFlagClient.isEnabled('test-flag');
      expect(result2).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should include userId in request when provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      await FeatureFlagClient.isEnabled('test-flag', 'user-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/feature-flags/check'),
        expect.objectContaining({
          body: JSON.stringify({ key: 'test-flag', userId: 'user-123' }),
        }),
      );
    });
  });

  describe('checkMultiple', () => {
    it('should return empty object for empty array', async () => {
      const result = await FeatureFlagClient.checkMultiple([]);

      expect(result).toEqual({});
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch multiple flags using bulk endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            flag1: true,
            flag2: false,
            flag3: true,
          },
        }),
      } as Response);

      const result = await FeatureFlagClient.checkMultiple(['flag1', 'flag2', 'flag3']);

      expect(result).toEqual({
        flag1: true,
        flag2: false,
        flag3: true,
      });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/feature-flags/check-bulk'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ keys: ['flag1', 'flag2', 'flag3'], userId: undefined }),
        }),
      );
    });

    it('should return false for all flags on API error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
      } as Response);

      const result = await FeatureFlagClient.checkMultiple(['flag1', 'flag2']);

      expect(result).toEqual({
        flag1: false,
        flag2: false,
      });
    });

    it('should return false for all flags on network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await FeatureFlagClient.checkMultiple(['flag1', 'flag2']);

      expect(result).toEqual({
        flag1: false,
        flag2: false,
      });
    });

    it('should use cache for cached flags and only fetch uncached ones', async () => {
      // First, populate cache with flag1
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { flag1: true } }),
      } as Response);

      await FeatureFlagClient.checkMultiple(['flag1']);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Now check flag1 (cached) and flag2 (not cached)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { flag2: false } }),
      } as Response);

      const result = await FeatureFlagClient.checkMultiple(['flag1', 'flag2']);

      expect(result).toEqual({
        flag1: true,
        flag2: false,
      });

      // Should only fetch flag2 since flag1 is cached
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/feature-flags/check-bulk'),
        expect.objectContaining({
          body: JSON.stringify({ keys: ['flag2'], userId: undefined }),
        }),
      );
    });

    it('should return cached results immediately if all flags are cached', async () => {
      // Populate cache
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { flag1: true, flag2: false },
        }),
      } as Response);

      await FeatureFlagClient.checkMultiple(['flag1', 'flag2']);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache only
      const result = await FeatureFlagClient.checkMultiple(['flag1', 'flag2']);

      expect(result).toEqual({
        flag1: true,
        flag2: false,
      });
      expect(fetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should include userId in request when provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { flag1: true },
        }),
      } as Response);

      await FeatureFlagClient.checkMultiple(['flag1'], 'user-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/feature-flags/check-bulk'),
        expect.objectContaining({
          body: JSON.stringify({ keys: ['flag1'], userId: 'user-123' }),
        }),
      );
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      // Populate cache
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      await FeatureFlagClient.isEnabled('test-flag');
      expect(fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      FeatureFlagClient.clearCache();

      // Next call should fetch again
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      await FeatureFlagClient.isEnabled('test-flag');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should expire cached values after TTL', async () => {
      vi.useFakeTimers();

      // Populate cache
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      await FeatureFlagClient.isEnabled('test-flag');
      expect(fetch).toHaveBeenCalledTimes(1);

      // Advance time by 4 minutes (should still use cache)
      vi.advanceTimersByTime(4 * 60 * 1000);

      const result1 = await FeatureFlagClient.isEnabled('test-flag');
      expect(result1).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1); // Still only 1 call

      // Advance time by another 2 minutes (total 6 minutes - cache expired)
      vi.advanceTimersByTime(2 * 60 * 1000);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: false }),
      } as Response);

      const result2 = await FeatureFlagClient.isEnabled('test-flag');
      expect(result2).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(2); // Should fetch again

      vi.useRealTimers();
    });
  });

  describe('duplicate keys handling', () => {
    it('should deduplicate keys in checkMultiple', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            flag1: true,
          },
        }),
      } as Response);

      // Pass duplicate keys
      const result = await FeatureFlagClient.checkMultiple(['flag1', 'flag1', 'flag1']);

      expect(result).toEqual({
        flag1: true,
      });

      // Should only check flag1 once
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/feature-flags/check-bulk'),
        expect.objectContaining({
          body: JSON.stringify({ keys: ['flag1'], userId: undefined }),
        }),
      );
    });
  });

  describe('useFeatureFlag hook', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      FeatureFlagClient.clearCache();
    });

    it('should fetch and return feature flag status', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      const { result } = renderHook(() => useFeatureFlag('test-flag'));

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.enabled).toBe(false);

      // Wait for the fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.enabled).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/feature-flags/check'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ key: 'test-flag', userId: undefined }),
        }),
      );
    });

    it('should handle userId parameter', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      const { result } = renderHook(() => useFeatureFlag('test-flag', 'user-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/feature-flags/check'),
        expect.objectContaining({
          body: JSON.stringify({ key: 'test-flag', userId: 'user-123' }),
        }),
      );
    });

    it('should not fetch when options.enabled is false', async () => {
      const { result } = renderHook(() =>
        useFeatureFlag('test-flag', undefined, { enabled: false }),
      );

      // Should immediately set loading to false and enabled to false
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.enabled).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch when options.enabled is true', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      const { result } = renderHook(() =>
        useFeatureFlag('test-flag', undefined, { enabled: true }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.enabled).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch when options is undefined (default behavior)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: false }),
      } as Response);

      const { result } = renderHook(() => useFeatureFlag('test-flag', undefined, undefined));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.enabled).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should not cause unnecessary re-renders with stable dependencies', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      let renderCount = 0;
      const { result, rerender } = renderHook(
        ({ key, userId, options }) => {
          renderCount++;
          return useFeatureFlag(key, userId, options);
        },
        {
          initialProps: {
            key: 'test-flag',
            userId: undefined,
            options: undefined,
          },
        },
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Rerender with same props
      rerender({
        key: 'test-flag',
        userId: undefined,
        options: undefined,
      });

      // Should only trigger component re-render, not useEffect
      expect(fetch).toHaveBeenCalledTimes(1); // Still only 1 fetch call
    });

    it('should re-fetch when key changes', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, enabled: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, enabled: false }),
        } as Response);

      const { result, rerender } = renderHook(({ key }) => useFeatureFlag(key), {
        initialProps: { key: 'flag-1' },
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.enabled).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Change key
      rerender({ key: 'flag-2' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.enabled).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should re-fetch when userId changes', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, enabled: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, enabled: false }),
        } as Response);

      const { result, rerender } = renderHook(({ userId }) => useFeatureFlag('test-flag', userId), {
        initialProps: { userId: 'user-1' },
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.enabled).toBe(true);

      // Change userId
      rerender({ userId: 'user-2' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.enabled).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should re-fetch when options.enabled changes from false to true', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, enabled: true }),
      } as Response);

      const { result, rerender } = renderHook(
        ({ enabled }) => useFeatureFlag('test-flag', undefined, { enabled }),
        {
          initialProps: { enabled: false },
        },
      );

      // Should not fetch when enabled is false
      expect(result.current.loading).toBe(false);
      expect(result.current.enabled).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(0);

      // Change to true
      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.enabled).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
