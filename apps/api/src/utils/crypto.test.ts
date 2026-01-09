import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('crypto utils', () => {
  beforeEach(() => {
    // Clear module cache to get fresh imports with new env vars
    vi.resetModules();
  });

  it('should encrypt and decrypt text successfully', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'test_salt_hex_value_12345678';

    const { encrypt, decrypt } = await import('./crypto');

    const originalText = 'sensitive_github_token_12345';
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(originalText);
  });

  it('should produce different encrypted output for same text (due to random IV)', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'test_salt_hex_value_12345678';

    const { encrypt } = await import('./crypto');

    const text = 'github_token';
    const encrypted1 = encrypt(text);
    const encrypted2 = encrypt(text);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should include IV, authTag, and encrypted text in correct format', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'test_salt_hex_value_12345678';

    const { encrypt } = await import('./crypto');

    const encrypted = encrypt('test');
    const parts = encrypted.split(':');

    expect(parts).toHaveLength(3);
    // IV should be 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32);
    // Auth tag should be 16 bytes = 32 hex chars (for GCM)
    expect(parts[1]).toHaveLength(32);
    // Encrypted text length varies but should exist
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should throw error for invalid encrypted text format', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'test_salt_hex_value_12345678';

    const { decrypt } = await import('./crypto');

    expect(() => decrypt('invalid')).toThrow('Invalid encrypted text format');
    expect(() => decrypt('only:two')).toThrow('Invalid encrypted text format');
    expect(() => decrypt('')).toThrow('Invalid encrypted text format');
  });

  it('should use different encryption keys for different salts', async () => {
    const text = 'github_token_test';

    // First encryption with salt1
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'salt_value_1';
    const { encrypt: encrypt1, decrypt: decrypt1 } = await import('./crypto');
    const encrypted1 = encrypt1(text);

    // Clear and reload with different salt
    vi.resetModules();
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'salt_value_2';
    const { decrypt: decrypt2 } = await import('./crypto');

    // Should not be able to decrypt with different salt
    expect(() => decrypt2(encrypted1)).toThrow();
  });

  it('should use random salt as fallback when ENCRYPTION_SALT is not set in development', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    delete process.env.ENCRYPTION_SALT;
    process.env.NODE_ENV = 'development';

    const { encrypt, decrypt } = await import('./crypto');

    const text = 'test_token';
    const encrypted = encrypt(text);
    const decrypted = decrypt(encrypted);

    // Should still work with random salt in development
    expect(decrypted).toBe(text);
  });

  it('should throw error when ENCRYPTION_SALT is not set in production', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    delete process.env.ENCRYPTION_SALT;
    process.env.NODE_ENV = 'production';

    await expect(async () => {
      await import('./crypto');
    }).rejects.toThrow('ENCRYPTION_SALT environment variable must be set in production');
  });

  it('should handle special characters in text', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'test_salt_hex_value_12345678';

    const { encrypt, decrypt } = await import('./crypto');

    const specialText = 'token!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
    const encrypted = encrypt(specialText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(specialText);
  });

  it('should handle unicode characters', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'test_salt_hex_value_12345678';

    const { encrypt, decrypt } = await import('./crypto');

    const unicodeText = '测试🔐🔑密码';
    const encrypted = encrypt(unicodeText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(unicodeText);
  });

  it('should handle empty string', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'test_salt_hex_value_12345678';

    const { encrypt, decrypt } = await import('./crypto');

    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe('');
  });

  it('should handle long text', async () => {
    process.env.ENCRYPTION_KEY = 'test_key_32_chars_long_secure!';
    process.env.ENCRYPTION_SALT = 'test_salt_hex_value_12345678';

    const { encrypt, decrypt } = await import('./crypto');

    const longText = 'a'.repeat(10000);
    const encrypted = encrypt(longText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(longText);
  });
});
