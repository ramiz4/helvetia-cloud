import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFloatEnv, parseIntEnv, parseStringEnv } from './configParser';
import { PLATFORM_DOMAIN_REGEX } from './constants';

describe('Config Parser Utilities', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    // Clean up any env vars set during tests
    delete process.env.TEST_INT;
    delete process.env.TEST_FLOAT;
    delete process.env.TEST_STRING;
  });

  describe('parseIntEnv', () => {
    describe('default behavior', () => {
      it('should return default value when env var is not set', () => {
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(100);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should parse valid integer values', () => {
        process.env.TEST_INT = '256';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(256);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should parse negative integer values', () => {
        process.env.TEST_INT = '-50';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(-50);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should parse zero', () => {
        process.env.TEST_INT = '0';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(0);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe('invalid value handling', () => {
      it('should return default for NaN values', () => {
        process.env.TEST_INT = 'not-a-number';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(100);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "[Config] Invalid TEST_INT value 'not-a-number', using default 100",
        );
      });

      it('should return default for empty string', () => {
        process.env.TEST_INT = '';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(100);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "[Config] Invalid TEST_INT value '', using default 100",
        );
      });

      it('should return default for special characters', () => {
        process.env.TEST_INT = '!!!';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(100);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should return default for mixed alphanumeric', () => {
        process.env.TEST_INT = 'abc123';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(100);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe('range validation', () => {
      it('should enforce minimum value', () => {
        process.env.TEST_INT = '50';
        const result = parseIntEnv('TEST_INT', 100, { min: 64 });
        expect(result).toBe(64);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[Config] TEST_INT value 50 below minimum 64, using 64',
        );
      });

      it('should enforce maximum value', () => {
        process.env.TEST_INT = '10000';
        const result = parseIntEnv('TEST_INT', 512, { max: 8192 });
        expect(result).toBe(8192);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[Config] TEST_INT value 10000 above maximum 8192, using 8192',
        );
      });

      it('should accept values within range', () => {
        process.env.TEST_INT = '1024';
        const result = parseIntEnv('TEST_INT', 512, { min: 64, max: 8192 });
        expect(result).toBe(1024);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should accept value equal to minimum', () => {
        process.env.TEST_INT = '64';
        const result = parseIntEnv('TEST_INT', 512, { min: 64, max: 8192 });
        expect(result).toBe(64);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should accept value equal to maximum', () => {
        process.env.TEST_INT = '8192';
        const result = parseIntEnv('TEST_INT', 512, { min: 64, max: 8192 });
        expect(result).toBe(8192);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle very large numbers', () => {
        process.env.TEST_INT = '999999999';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(999999999);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should handle decimal strings by truncating', () => {
        process.env.TEST_INT = '123.456';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(123);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should handle whitespace by parsing', () => {
        process.env.TEST_INT = '  200  ';
        const result = parseIntEnv('TEST_INT', 100);
        expect(result).toBe(200);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('parseFloatEnv', () => {
    describe('default behavior', () => {
      it('should return default value when env var is not set', () => {
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(1.0);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should parse valid float values', () => {
        process.env.TEST_FLOAT = '2.5';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(2.5);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should parse integer strings as floats', () => {
        process.env.TEST_FLOAT = '3';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(3.0);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should parse negative float values', () => {
        process.env.TEST_FLOAT = '-1.5';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(-1.5);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should parse zero', () => {
        process.env.TEST_FLOAT = '0.0';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(0.0);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe('invalid value handling', () => {
      it('should return default for NaN values', () => {
        process.env.TEST_FLOAT = 'not-a-number';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(1.0);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "[Config] Invalid TEST_FLOAT value 'not-a-number', using default 1",
        );
      });

      it('should return default for empty string', () => {
        process.env.TEST_FLOAT = '';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(1.0);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "[Config] Invalid TEST_FLOAT value '', using default 1",
        );
      });

      it('should return default for special characters', () => {
        process.env.TEST_FLOAT = '!!!';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(1.0);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe('range validation', () => {
      it('should enforce minimum value', () => {
        process.env.TEST_FLOAT = '0.25';
        const result = parseFloatEnv('TEST_FLOAT', 1.0, { min: 0.5 });
        expect(result).toBe(0.5);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[Config] TEST_FLOAT value 0.25 below minimum 0.5, using 0.5',
        );
      });

      it('should enforce maximum value', () => {
        process.env.TEST_FLOAT = '10.0';
        const result = parseFloatEnv('TEST_FLOAT', 1.0, { max: 8.0 });
        expect(result).toBe(8.0);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[Config] TEST_FLOAT value 10 above maximum 8, using 8',
        );
      });

      it('should accept values within range', () => {
        process.env.TEST_FLOAT = '1.5';
        const result = parseFloatEnv('TEST_FLOAT', 1.0, { min: 0.5, max: 8.0 });
        expect(result).toBe(1.5);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should accept value equal to minimum', () => {
        process.env.TEST_FLOAT = '0.5';
        const result = parseFloatEnv('TEST_FLOAT', 1.0, { min: 0.5, max: 8.0 });
        expect(result).toBe(0.5);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should accept value equal to maximum', () => {
        process.env.TEST_FLOAT = '8.0';
        const result = parseFloatEnv('TEST_FLOAT', 1.0, { min: 0.5, max: 8.0 });
        expect(result).toBe(8.0);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle very large decimal numbers', () => {
        process.env.TEST_FLOAT = '999999.999';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(999999.999);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should handle scientific notation', () => {
        process.env.TEST_FLOAT = '1e3';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(1000);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should handle whitespace', () => {
        process.env.TEST_FLOAT = '  2.5  ';
        const result = parseFloatEnv('TEST_FLOAT', 1.0);
        expect(result).toBe(2.5);
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('parseStringEnv', () => {
    describe('default behavior', () => {
      it('should return default value when env var is not set', () => {
        const result = parseStringEnv('TEST_STRING', 'default-value');
        expect(result).toBe('default-value');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should return env var value when set', () => {
        process.env.TEST_STRING = 'test-value';
        const result = parseStringEnv('TEST_STRING', 'default-value');
        expect(result).toBe('test-value');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should handle empty string and use default', () => {
        process.env.TEST_STRING = '';
        const result = parseStringEnv('TEST_STRING', 'default-value');
        expect(result).toBe('default-value');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid TEST_STRING value (empty string)'),
        );
      });
    });

    describe('validation', () => {
      it('should use default when validation fails', () => {
        process.env.TEST_STRING = 'invalid';
        const result = parseStringEnv('TEST_STRING', 'default-value', {
          validate: (value) => value === 'valid',
          errorMessage: 'must be "valid"',
        });
        expect(result).toBe('default-value');
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('must be "valid"'));
      });

      it('should accept value when validation passes', () => {
        process.env.TEST_STRING = 'valid';
        const result = parseStringEnv('TEST_STRING', 'default-value', {
          validate: (value) => value === 'valid',
        });
        expect(result).toBe('valid');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should handle domain validation', () => {
        process.env.TEST_STRING = 'example.com';
        const result = parseStringEnv('TEST_STRING', 'default.com', {
          validate: (value) => PLATFORM_DOMAIN_REGEX.test(value),
          errorMessage: 'must be a valid domain',
        });
        expect(result).toBe('example.com');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should reject invalid domain', () => {
        process.env.TEST_STRING = 'not a domain';
        const result = parseStringEnv('TEST_STRING', 'default.com', {
          validate: (value) => PLATFORM_DOMAIN_REGEX.test(value),
          errorMessage: 'must be a valid domain',
        });
        expect(result).toBe('default.com');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('must be a valid domain'),
        );
      });

      it('should validate multi-level domains', () => {
        process.env.TEST_STRING = 'api.helvetia.cloud';
        const result = parseStringEnv('TEST_STRING', 'default.com', {
          validate: (value) => PLATFORM_DOMAIN_REGEX.test(value),
          errorMessage: 'must be a valid domain',
        });
        expect(result).toBe('api.helvetia.cloud');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should validate deeply nested domains', () => {
        process.env.TEST_STRING = 'staging.api.helvetia.cloud';
        const result = parseStringEnv('TEST_STRING', 'default.com', {
          validate: (value) => PLATFORM_DOMAIN_REGEX.test(value),
          errorMessage: 'must be a valid domain',
        });
        expect(result).toBe('staging.api.helvetia.cloud');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe('whitespace handling', () => {
      it('should trim leading and trailing whitespace', () => {
        process.env.TEST_STRING = '  trimmed-value  ';
        const result = parseStringEnv('TEST_STRING', 'default-value');
        expect(result).toBe('trimmed-value');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should trim whitespace before validation', () => {
        process.env.TEST_STRING = '  valid  ';
        const result = parseStringEnv('TEST_STRING', 'default-value', {
          validate: (value) => value === 'valid',
        });
        expect(result).toBe('valid');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should treat whitespace-only string as empty', () => {
        process.env.TEST_STRING = '   ';
        const result = parseStringEnv('TEST_STRING', 'default-value');
        expect(result).toBe('default-value');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Invalid TEST_STRING value (empty string)'),
        );
      });
    });
  });
});
