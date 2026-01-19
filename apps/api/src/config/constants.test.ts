import { describe, expect, it } from 'vitest';
import * as constants from './constants.js';

describe('Configuration Constants', () => {
  describe('Container Resource Limits', () => {
    it('should re-export container constants from shared package', () => {
      // Verify the constants are properly re-exported
      expect(constants.CONTAINER_MEMORY_LIMIT_MB).toBeDefined();
      expect(constants.CONTAINER_MEMORY_LIMIT_BYTES).toBeDefined();
      expect(constants.CONTAINER_CPU_CORES).toBeDefined();
      expect(constants.CONTAINER_CPU_NANOCPUS).toBeDefined();

      // Basic type checks
      expect(typeof constants.CONTAINER_MEMORY_LIMIT_MB).toBe('number');
      expect(typeof constants.CONTAINER_MEMORY_LIMIT_BYTES).toBe('number');
      expect(typeof constants.CONTAINER_CPU_CORES).toBe('number');
      expect(typeof constants.CONTAINER_CPU_NANOCPUS).toBe('number');
    });
  });

  describe('Time Intervals', () => {
    it('should use default metrics update interval (5000ms)', () => {
      expect(constants.METRICS_UPDATE_INTERVAL_MS).toBe(5000);
    });

    it('should use default reconciliation interval (30000ms)', () => {
      expect(constants.STATUS_RECONCILIATION_INTERVAL_MS).toBe(30000);
    });

    it('should use default connection timeout (30 minutes)', () => {
      expect(constants.CONNECTION_TIMEOUT_MS).toBe(30 * 60 * 1000);
    });
  });

  describe('Lock Configuration', () => {
    it('should use default lock TTL (10000ms)', () => {
      expect(constants.STATUS_LOCK_TTL_MS).toBe(10000);
    });

    it('should use default reconciliation lock TTL (5000ms)', () => {
      expect(constants.STATUS_RECONCILIATION_LOCK_TTL_MS).toBe(5000);
    });

    it('should use default retry delay (200ms)', () => {
      expect(constants.LOCK_RETRY_DELAY_MS).toBe(200);
    });

    it('should use default retry jitter (100ms)', () => {
      expect(constants.LOCK_RETRY_JITTER_MS).toBe(100);
    });
  });

  describe('Body Size Limits', () => {
    it('should use default global body limit (10MB)', () => {
      expect(constants.BODY_LIMIT_GLOBAL).toBe(10 * 1024 * 1024);
    });

    it('should use default standard body limit (1MB)', () => {
      expect(constants.BODY_LIMIT_STANDARD).toBe(1 * 1024 * 1024);
    });

    it('should use default small body limit (100KB)', () => {
      expect(constants.BODY_LIMIT_SMALL).toBe(100 * 1024);
    });
  });

  describe('Environment Variable Parsing', () => {
    it('should parse integer values correctly', () => {
      expect(typeof constants.METRICS_UPDATE_INTERVAL_MS).toBe('number');
      expect(typeof constants.STATUS_LOCK_TTL_MS).toBe('number');
    });

    it('should calculate byte values from MB correctly', () => {
      expect(constants.BODY_LIMIT_GLOBAL).toBe(
        parseInt(process.env.BODY_LIMIT_GLOBAL_MB || '10', 10) * 1024 * 1024,
      );
      expect(constants.BODY_LIMIT_STANDARD).toBe(
        parseInt(process.env.BODY_LIMIT_STANDARD_MB || '1', 10) * 1024 * 1024,
      );
    });

    it('should calculate byte values from KB correctly', () => {
      expect(constants.BODY_LIMIT_SMALL).toBe(
        parseInt(process.env.BODY_LIMIT_SMALL_KB || '100', 10) * 1024,
      );
    });
  });
});
