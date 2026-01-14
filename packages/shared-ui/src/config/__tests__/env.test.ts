import { describe, expect, it } from 'vitest';
import { validateEnv } from '../env';

describe('env', () => {
  describe('validateEnv', () => {
    it('should return validated environment variables with defaults', () => {
      const env = validateEnv();

      expect(env).toBeDefined();
      expect(env.NEXT_PUBLIC_API_URL).toBeDefined();
      expect(env.NEXT_PUBLIC_WS_URL).toBeDefined();
      expect(env.NEXT_PUBLIC_APP_URL).toBeDefined();
      expect(env.NEXT_PUBLIC_PLATFORM_DOMAIN).toBeDefined();
      expect(env.NODE_ENV).toBe('test');
    });

    it('should have correct default values', () => {
      const env = validateEnv();

      expect(env.NEXT_PUBLIC_API_URL).toBe('http://localhost:3001');
      expect(env.NEXT_PUBLIC_WS_URL).toBe('ws://localhost:3001');
      expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
      expect(env.NEXT_PUBLIC_PLATFORM_DOMAIN).toBe('helvetia.localhost');
    });
  });
});
