import bcrypt from 'bcrypt';

/**
 * Number of salt rounds for bcrypt hashing
 * Higher values increase security but also increase computation time
 * 12 is a good balance between security and performance
 */
const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt with salt
 * @param password - Plain text password to hash
 * @returns Promise that resolves to the hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise that resolves to true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if a hash is a legacy SHA-256 hash (without salt)
 * Legacy hashes are 64 characters long (hex string)
 * Bcrypt hashes start with $2a$, $2b$, or $2y$
 * @param hash - Hash to check
 * @returns True if the hash is a legacy SHA-256 hash
 */
export function isLegacyHash(hash: string): boolean {
  // Bcrypt hashes start with version identifier
  const isBcryptHash = /^\$2[aby]\$/.test(hash);

  // Legacy SHA-256 hashes are 64 hex characters
  const isSHA256Hash = /^[a-f0-9]{64}$/i.test(hash);

  return !isBcryptHash && isSHA256Hash;
}
