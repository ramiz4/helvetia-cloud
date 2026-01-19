import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, isLegacyHash, verifyPassword } from './password.js';

describe('password utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password using bcrypt', async () => {
      const password = 'mySecurePassword123!';
      const hash = await hashPassword(password);

      // Bcrypt hashes start with $2a$, $2b$, or $2y$ and are ~60 chars
      expect(hash).toMatch(/^\$2[aby]\$/);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for the same password (due to salt)', async () => {
      const password = 'mySecurePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Different salts should produce different hashes
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hash = await hashPassword(password);

      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should handle long passwords', async () => {
      const password = 'a'.repeat(100);
      const hash = await hashPassword(password);

      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should handle special characters', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:",.<>?/~`';
      const hash = await hashPassword(password);

      expect(hash).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      const password = 'mySecurePassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'mySecurePassword123!';
      const wrongPassword = 'wrongPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should reject empty password when hash is not empty', async () => {
      const password = 'mySecurePassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('', hash);

      expect(isValid).toBe(false);
    });

    it('should handle case sensitivity', async () => {
      const password = 'MyPassword123!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('mypassword123!', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('isLegacyHash', () => {
    it('should identify bcrypt hashes as not legacy', () => {
      const bcryptHashes = [
        '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
        '$2b$10$nOUIs5kJ7naTuTFkBy1veuK0kSxUFXfuaOKdOKf9xYT0KKIGSJwFa',
        '$2y$10$Qh0/.4jK4u5y9FP1lC6mzeJQqiNTjR.YpnVlKNYu4XfX7rWzlVZaC',
      ];

      bcryptHashes.forEach((hash) => {
        expect(isLegacyHash(hash)).toBe(false);
      });
    });

    it('should identify SHA-256 hashes as legacy', () => {
      // Generate a SHA-256 hash
      const sha256Hash = crypto.createHash('sha256').update('password123').digest('hex');

      expect(isLegacyHash(sha256Hash)).toBe(true);
      expect(sha256Hash.length).toBe(64);
    });

    it('should handle mixed case SHA-256 hashes', () => {
      const sha256Hash = crypto.createHash('sha256').update('password123').digest('hex');
      const upperCaseHash = sha256Hash.toUpperCase();
      const mixedCaseHash = sha256Hash.slice(0, 32).toUpperCase() + sha256Hash.slice(32);

      expect(isLegacyHash(upperCaseHash)).toBe(true);
      expect(isLegacyHash(mixedCaseHash)).toBe(true);
    });

    it('should reject invalid hashes', () => {
      const invalidHashes = [
        'notahash',
        '123456',
        '',
        'abcdef', // Too short
        'g'.repeat(64), // Invalid hex characters
      ];

      invalidHashes.forEach((hash) => {
        expect(isLegacyHash(hash)).toBe(false);
      });
    });
  });
});
