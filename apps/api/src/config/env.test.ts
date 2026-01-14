import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateEnv } from './env';

describe('Environment Validation - API', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('Required Variables', () => {
    it('should fail when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;
      expect(() => validateEnv()).toThrow(/DATABASE_URL/);
    });

    it('should fail when REDIS_URL is missing', () => {
      delete process.env.REDIS_URL;
      expect(() => validateEnv()).toThrow(/REDIS_URL/);
    });

    it('should fail when GITHUB_CLIENT_ID is missing', () => {
      delete process.env.GITHUB_CLIENT_ID;
      expect(() => validateEnv()).toThrow(/GITHUB_CLIENT_ID/);
    });

    it('should fail when GITHUB_CLIENT_SECRET is missing', () => {
      delete process.env.GITHUB_CLIENT_SECRET;
      expect(() => validateEnv()).toThrow(/GITHUB_CLIENT_SECRET/);
    });

    it('should fail when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;
      expect(() => validateEnv()).toThrow(/JWT_SECRET/);
    });

    it('should fail when ENCRYPTION_KEY is missing', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => validateEnv()).toThrow(/ENCRYPTION_KEY/);
    });

    it('should fail when ENCRYPTION_KEY is not 32 characters', () => {
      process.env.ENCRYPTION_KEY = 'short';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.JWT_SECRET = 'test-jwt-secret';
      expect(() => validateEnv()).toThrow(/ENCRYPTION_KEY/);
    });
  });

  describe('Default Values', () => {
    it('should use default values for optional variables', () => {
      // Set only required variables
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
      delete process.env.PLATFORM_DOMAIN;
      delete process.env.APP_BASE_URL;

      const env = validateEnv();

      // NODE_ENV is 'test' when running tests
      expect(env.NODE_ENV).toBe('test');
      expect(env.PORT).toBe(3001);
      expect(env.PLATFORM_DOMAIN).toBe('helvetia.cloud');
      expect(env.RATE_LIMIT_MAX).toBe(100);
      expect(env.CONTAINER_MEMORY_LIMIT_MB).toBe(512);
      expect(env.CONTAINER_CPU_CORES).toBe(1.0);
      expect(env.LOG_LEVEL).toBe('info');
    });
  });

  describe('Type Transformations', () => {
    beforeEach(() => {
      // Set required variables
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
    });

    it('should transform string numbers to numbers', () => {
      process.env.PORT = '8080';
      process.env.RATE_LIMIT_MAX = '200';
      process.env.CONTAINER_MEMORY_LIMIT_MB = '1024';

      const env = validateEnv();

      expect(env.PORT).toBe(8080);
      expect(env.RATE_LIMIT_MAX).toBe(200);
      expect(env.CONTAINER_MEMORY_LIMIT_MB).toBe(1024);
    });

    it('should transform string floats to numbers', () => {
      process.env.CONTAINER_CPU_CORES = '2.5';

      const env = validateEnv();

      expect(env.CONTAINER_CPU_CORES).toBe(2.5);
    });

    it('should transform LOG_REQUESTS string to boolean', () => {
      process.env.LOG_REQUESTS = 'false';
      const env = validateEnv();
      expect(env.LOG_REQUESTS).toBe(false);

      process.env.LOG_REQUESTS = 'true';
      const env2 = validateEnv();
      expect(env2.LOG_REQUESTS).toBe(true);
    });
  });

  describe('Validation Rules', () => {
    beforeEach(() => {
      // Set required variables
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.GITHUB_CLIENT_ID = 'test-client-id';
      process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
    });

    it('should validate NODE_ENV values', () => {
      process.env.NODE_ENV = 'invalid';
      expect(() => validateEnv()).toThrow();

      process.env.NODE_ENV = 'production';
      expect(() => validateEnv()).not.toThrow();
    });

    it('should validate LOG_LEVEL values', () => {
      process.env.LOG_LEVEL = 'invalid';
      expect(() => validateEnv()).toThrow();

      process.env.LOG_LEVEL = 'debug';
      expect(() => validateEnv()).not.toThrow();
    });

    it('should validate URL format for DATABASE_URL', () => {
      process.env.DATABASE_URL = 'not-a-url';
      expect(() => validateEnv()).toThrow();

      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      expect(() => validateEnv()).not.toThrow();
    });

    it('should validate URL format for REDIS_URL', () => {
      process.env.REDIS_URL = 'not-a-url';
      expect(() => validateEnv()).toThrow();

      process.env.REDIS_URL = 'redis://localhost:6379';
      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error messages for multiple validation failures', () => {
      delete process.env.DATABASE_URL;
      delete process.env.REDIS_URL;
      delete process.env.JWT_SECRET;

      try {
        validateEnv();
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Invalid environment variables');
        expect(errorMessage).toContain('DATABASE_URL');
        expect(errorMessage).toContain('REDIS_URL');
        expect(errorMessage).toContain('JWT_SECRET');
      }
    });
  });
});
