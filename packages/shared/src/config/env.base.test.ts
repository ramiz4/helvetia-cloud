import { describe, expect, it } from 'vitest';
import { baseEnvSchema, floatFromString, intFromString, validateEnvironment } from './env.base.js';

describe('intFromString', () => {
  it('should parse integer from string', () => {
    const schema = intFromString('100');
    expect(schema.parse('123')).toBe(123);
  });

  it('should use default value when not provided', () => {
    const schema = intFromString('100');
    expect(schema.parse(undefined)).toBe(100);
  });

  it('should reject non-numeric strings', () => {
    const schema = intFromString('100');
    expect(() => schema.parse('abc')).toThrow();
  });
});

describe('floatFromString', () => {
  it('should parse float from string', () => {
    const schema = floatFromString('1.0');
    expect(schema.parse('2.5')).toBe(2.5);
  });

  it('should use default value when not provided', () => {
    const schema = floatFromString('1.5');
    expect(schema.parse(undefined)).toBe(1.5);
  });

  it('should reject non-numeric strings', () => {
    const schema = floatFromString('1.0');
    expect(() => schema.parse('abc')).toThrow();
  });
});

describe('baseEnvSchema', () => {
  it('should validate required environment variables', () => {
    const env = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      PLATFORM_DOMAIN: 'helvetia.cloud',
    };

    const result = baseEnvSchema.parse(env);

    expect(result.NODE_ENV).toBe('development');
    expect(result.DATABASE_URL).toBe('postgresql://localhost:5432/db');
    expect(result.REDIS_URL).toBe('redis://localhost:6379');
    expect(result.PLATFORM_DOMAIN).toBe('helvetia.cloud');
  });

  it('should use default values for optional fields', () => {
    const env = {
      DATABASE_URL: 'postgresql://localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
    };

    const result = baseEnvSchema.parse(env);

    expect(result.NODE_ENV).toBe('development');
    expect(result.PLATFORM_DOMAIN).toBe('helvetia.cloud');
    expect(result.CONTAINER_MEMORY_LIMIT_MB).toBe(512);
    expect(result.CONTAINER_CPU_CORES).toBe(1.0);
  });

  it('should reject invalid NODE_ENV values', () => {
    const env = {
      NODE_ENV: 'invalid',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
    };

    expect(() => baseEnvSchema.parse(env)).toThrow();
  });

  it('should reject invalid DATABASE_URL', () => {
    const env = {
      DATABASE_URL: 'not-a-url',
      REDIS_URL: 'redis://localhost:6379',
    };

    expect(() => baseEnvSchema.parse(env)).toThrow();
  });

  it('should reject invalid REDIS_URL', () => {
    const env = {
      DATABASE_URL: 'postgresql://localhost:5432/db',
      REDIS_URL: 'not-a-url',
    };

    expect(() => baseEnvSchema.parse(env)).toThrow();
  });
});

describe('validateEnvironment', () => {
  it('should validate environment successfully', () => {
    const env = {
      DATABASE_URL: 'postgresql://localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
    };

    const result = validateEnvironment(baseEnvSchema, env);

    expect(result.DATABASE_URL).toBe('postgresql://localhost:5432/db');
    expect(result.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('should throw formatted error on validation failure', () => {
    const env = {
      DATABASE_URL: 'not-a-url',
      REDIS_URL: 'redis://localhost:6379',
    };

    expect(() => validateEnvironment(baseEnvSchema, env)).toThrow(
      /❌ Invalid environment variables:/,
    );
  });

  it('should include error details in formatted error', () => {
    const env = {
      DATABASE_URL: 'not-a-url',
      REDIS_URL: 'not-a-url-either',
    };

    try {
      validateEnvironment(baseEnvSchema, env);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('REDIS_URL');
      expect(message).toContain('Please check your .env file');
    }
  });
});
