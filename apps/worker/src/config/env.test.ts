import { beforeEach, describe, expect, it } from 'vitest';
import { validateEnv } from './env';

describe('Environment Validation - Worker', () => {
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
      expect(() => validateEnv()).toThrow('DATABASE_URL is required');
    });

    it('should fail when REDIS_URL is missing', () => {
      delete process.env.REDIS_URL;
      expect(() => validateEnv()).toThrow('REDIS_URL is required');
    });
  });

  describe('Default Values', () => {
    it('should use default values for optional variables', () => {
      // Set only required variables
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const env = validateEnv();

      expect(env.NODE_ENV).toBe('development');
      expect(env.PLATFORM_DOMAIN).toBe('helvetia.cloud');
      expect(env.CONTAINER_MEMORY_LIMIT_MB).toBe(512);
      expect(env.CONTAINER_CPU_CORES).toBe(1.0);
      expect(env.MAX_LOG_SIZE_CHARS).toBe(50000);
      expect(env.WORKER_HEALTH_PORT).toBe(3002);
      expect(env.WORKSPACE_DIR).toBe('/tmp/helvetia-workspaces');
    });
  });

  describe('Type Transformations', () => {
    beforeEach(() => {
      // Set required variables
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    it('should transform string numbers to numbers', () => {
      process.env.CONTAINER_MEMORY_LIMIT_MB = '1024';
      process.env.MAX_LOG_SIZE_CHARS = '100000';
      process.env.WORKER_HEALTH_PORT = '8080';

      const env = validateEnv();

      expect(env.CONTAINER_MEMORY_LIMIT_MB).toBe(1024);
      expect(env.MAX_LOG_SIZE_CHARS).toBe(100000);
      expect(env.WORKER_HEALTH_PORT).toBe(8080);
    });

    it('should transform string floats to numbers', () => {
      process.env.CONTAINER_CPU_CORES = '2.5';

      const env = validateEnv();

      expect(env.CONTAINER_CPU_CORES).toBe(2.5);
    });
  });

  describe('Validation Rules', () => {
    beforeEach(() => {
      // Set required variables
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    it('should validate NODE_ENV values', () => {
      process.env.NODE_ENV = 'invalid';
      expect(() => validateEnv()).toThrow();

      process.env.NODE_ENV = 'production';
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

  describe('Optional Variables', () => {
    beforeEach(() => {
      // Set required variables
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    it('should accept optional DOCKER_HOST', () => {
      process.env.DOCKER_HOST = 'tcp://docker-host:2375';
      expect(() => validateEnv()).not.toThrow();

      delete process.env.DOCKER_HOST;
      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error messages for multiple validation failures', () => {
      delete process.env.DATABASE_URL;
      delete process.env.REDIS_URL;

      try {
        validateEnv();
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Invalid environment variables');
        expect(errorMessage).toContain('DATABASE_URL');
        expect(errorMessage).toContain('REDIS_URL');
      }
    });
  });
});
