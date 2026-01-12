import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL, validateEnv } from './env';

describe('Environment Validation - Dashboard', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('Default Values', () => {
    it('should use default values for all variables', () => {
      const env = validateEnv();

      expect(env.NEXT_PUBLIC_API_URL).toBe('http://localhost:3001');
      expect(env.NEXT_PUBLIC_WS_URL).toBe('ws://localhost:3001');
      expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
      // NODE_ENV is 'test' when running tests
      expect(env.NODE_ENV).toBe('test');
    });

    it('should append /api/v1 to API_BASE_URL', () => {
      // API_BASE_URL should include the version prefix
      expect(API_BASE_URL).toContain('/api/v1');
      expect(API_BASE_URL).toBe('http://localhost:3001/api/v1');
    });
  });

  describe('Custom Values', () => {
    it('should accept custom environment variable values', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
      process.env.NEXT_PUBLIC_WS_URL = 'wss://api.example.com';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = 'my-github-client-id';

      const env = validateEnv();

      expect(env.NEXT_PUBLIC_API_URL).toBe('https://api.example.com');
      expect(env.NEXT_PUBLIC_WS_URL).toBe('wss://api.example.com');
      expect(env.NEXT_PUBLIC_APP_URL).toBe('https://app.example.com');
      expect(env.NEXT_PUBLIC_GITHUB_CLIENT_ID).toBe('my-github-client-id');
    });
  });

  describe('Validation Rules', () => {
    it('should validate NODE_ENV values', () => {
      process.env.NODE_ENV = 'invalid';
      expect(() => validateEnv()).toThrow();

      process.env.NODE_ENV = 'production';
      expect(() => validateEnv()).not.toThrow();
    });

    it('should validate URL format for NEXT_PUBLIC_API_URL', () => {
      process.env.NEXT_PUBLIC_API_URL = 'not-a-url';
      expect(() => validateEnv()).toThrow();

      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
      expect(() => validateEnv()).not.toThrow();
    });

    it('should validate URL format for NEXT_PUBLIC_APP_URL', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'not-a-url';
      expect(() => validateEnv()).toThrow();

      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe('Optional Variables', () => {
    it('should accept optional NEXT_PUBLIC_GITHUB_CLIENT_ID', () => {
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = 'test-client-id';
      expect(() => validateEnv()).not.toThrow();

      delete process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error messages for validation failures', () => {
      process.env.NEXT_PUBLIC_API_URL = 'invalid-url';
      process.env.NODE_ENV = 'invalid-env';

      try {
        validateEnv();
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Invalid environment variables');
      }
    });
  });
});
