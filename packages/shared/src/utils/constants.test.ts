import { describe, expect, it } from 'vitest';
import * as constants from './constants';

describe('Shared Constants', () => {
  describe('Container Resource Limits', () => {
    it('should use default memory limit (512MB)', () => {
      expect(constants.CONTAINER_MEMORY_LIMIT_MB).toBe(512);
      expect(constants.CONTAINER_MEMORY_LIMIT_BYTES).toBe(512 * 1024 * 1024);
    });

    it('should calculate memory limit in bytes correctly', () => {
      expect(constants.CONTAINER_MEMORY_LIMIT_BYTES).toBe(
        constants.CONTAINER_MEMORY_LIMIT_MB * 1024 * 1024,
      );
    });

    it('should use default CPU cores (1.0)', () => {
      expect(constants.CONTAINER_CPU_CORES).toBe(1.0);
      expect(constants.CONTAINER_CPU_NANOCPUS).toBe(1000000000);
    });

    it('should calculate CPU nanocpus correctly', () => {
      expect(constants.CONTAINER_CPU_NANOCPUS).toBe(
        Math.floor(constants.CONTAINER_CPU_CORES * 1000000000),
      );
    });

    it('should parse integer values correctly', () => {
      expect(typeof constants.CONTAINER_MEMORY_LIMIT_MB).toBe('number');
      expect(Number.isInteger(constants.CONTAINER_MEMORY_LIMIT_MB)).toBe(true);
    });

    it('should parse float values correctly', () => {
      expect(typeof constants.CONTAINER_CPU_CORES).toBe('number');
      expect(constants.CONTAINER_CPU_CORES).toBeGreaterThan(0);
    });

    it('should calculate memory bytes from MB correctly', () => {
      const expectedBytes =
        parseInt(process.env.CONTAINER_MEMORY_LIMIT_MB || '512', 10) * 1024 * 1024;
      expect(constants.CONTAINER_MEMORY_LIMIT_BYTES).toBe(expectedBytes);
    });

    it('should calculate CPU nanocpus from cores correctly', () => {
      const expectedNanocpus = Math.floor(
        parseFloat(process.env.CONTAINER_CPU_CORES || '1.0') * 1000000000,
      );
      expect(constants.CONTAINER_CPU_NANOCPUS).toBe(expectedNanocpus);
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
});
