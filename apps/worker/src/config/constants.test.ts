import { describe, expect, it } from 'vitest';
import * as constants from './constants';

describe('Worker Configuration Constants', () => {
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

  describe('Log Size Limits', () => {
    it('should use default max log size (50000 chars)', () => {
      expect(constants.MAX_LOG_SIZE_CHARS).toBe(50000);
    });

    it('should be a positive integer', () => {
      expect(constants.MAX_LOG_SIZE_CHARS).toBeGreaterThan(0);
      expect(Number.isInteger(constants.MAX_LOG_SIZE_CHARS)).toBe(true);
    });
  });

  describe('Lock Configuration', () => {
    it('should use default lock TTL (10000ms)', () => {
      expect(constants.STATUS_LOCK_TTL_MS).toBe(10000);
    });

    it('should use default retry delay (200ms)', () => {
      expect(constants.LOCK_RETRY_DELAY_MS).toBe(200);
    });

    it('should use default retry jitter (100ms)', () => {
      expect(constants.LOCK_RETRY_JITTER_MS).toBe(100);
    });

    it('should have positive lock configuration values', () => {
      expect(constants.STATUS_LOCK_TTL_MS).toBeGreaterThan(0);
      expect(constants.LOCK_RETRY_DELAY_MS).toBeGreaterThan(0);
      expect(constants.LOCK_RETRY_JITTER_MS).toBeGreaterThan(0);
    });
  });

  describe('Environment Variable Parsing', () => {
    it('should parse integer values correctly', () => {
      expect(typeof constants.MAX_LOG_SIZE_CHARS).toBe('number');
      expect(typeof constants.STATUS_LOCK_TTL_MS).toBe('number');
    });
  });
});
