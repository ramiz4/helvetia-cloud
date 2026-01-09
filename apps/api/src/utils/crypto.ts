import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY = process.env.ENCRYPTION_KEY || 'development_key_32_chars_long_!!';

// ENCRYPTION_SALT must be set in production to ensure data consistency
// Using a random salt in development for security, but note that restarting
// the server will make previously encrypted data unrecoverable
const SALT =
  process.env.ENCRYPTION_SALT ||
  (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_SALT environment variable must be set in production');
    }
    // Development fallback - generates new salt on each start
    console.warn(
      'WARNING: ENCRYPTION_SALT not set. Using random salt. Previously encrypted data will be unrecoverable on restart.',
    );
    return crypto.randomBytes(32).toString('hex');
  })();

// Ensure the key is 32 bytes
const ENCRYPTION_KEY = crypto.scryptSync(KEY, SALT, 32);

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text: string): string {
  const [ivHex, authTagHex, encryptedText] = text.split(':');

  if (!ivHex || !authTagHex || encryptedText === undefined) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
