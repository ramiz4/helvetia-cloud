# Encryption Salt Migration Guide

## Overview

This document provides instructions for migrating from the old hardcoded salt encryption to the new secure salt-based encryption system.

## Background

Previously, the encryption module used a hardcoded salt value (`'salt'`) for key derivation, which made GitHub access tokens vulnerable to rainbow table attacks. The new implementation uses a configurable salt stored in environment variables.

## Changes Made

### 1. Crypto Module Updates

- **File**: `apps/api/src/utils/crypto.ts`
- **Change**: Replaced hardcoded `'salt'` with `process.env.ENCRYPTION_SALT || crypto.randomBytes(32).toString('hex')`
- **Impact**: Encryption keys are now derived using a unique, secure salt per installation

### 2. Environment Variables

- **File**: `.env.example`
- **New Variable**: `ENCRYPTION_SALT=your_random_hex_salt_value`

## Migration Steps

### For New Installations

1. Generate a secure random salt (32 bytes recommended):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Add the generated salt to your `.env` file:

   ```env
   ENCRYPTION_SALT=your_generated_hex_value_here
   ```

3. Ensure `ENCRYPTION_KEY` is also set:

   ```env
   ENCRYPTION_KEY=your_32_character_encryption_key
   ```

4. Start the application normally

### For Existing Installations (With Encrypted Data)

**IMPORTANT**: Existing encrypted GitHub access tokens in your database will need to be re-encrypted because the encryption key has changed.

#### Option 1: Re-authenticate Users (Recommended)

This is the safest and simplest approach:

1. **Before deploying the changes**:
   - Notify users that they will need to re-authenticate with GitHub
   - Optionally, clear existing tokens from the database:
     ```sql
     UPDATE "User" SET "githubAccessToken" = NULL;
     ```

2. **Deploy the changes**:
   - Generate and set `ENCRYPTION_SALT` in your `.env` file
   - Deploy the updated code

3. **User Action**:
   - Users will be prompted to reconnect their GitHub accounts
   - New tokens will be encrypted with the secure salt

#### Option 2: Migrate Existing Tokens (Advanced)

If you cannot have users re-authenticate, you can migrate existing tokens:

1. **Create a migration script** (`migrate-encryption.ts`):

   ```typescript
   import crypto from 'crypto';
   import { prisma } from 'database'; // Adjust import path based on your project structure
   import dotenv from 'dotenv';

   dotenv.config();

   // Old encryption setup (hardcoded salt)
   const OLD_KEY = process.env.ENCRYPTION_KEY || 'development_key_32_chars_long_!!';
   const OLD_ENCRYPTION_KEY = crypto.scryptSync(OLD_KEY, 'salt', 32);

   // New encryption setup (secure salt)
   const NEW_SALT = process.env.ENCRYPTION_SALT;
   if (!NEW_SALT) {
     throw new Error('ENCRYPTION_SALT must be set for migration');
   }
   const NEW_ENCRYPTION_KEY = crypto.scryptSync(OLD_KEY, NEW_SALT, 32);

   function decryptOld(text: string): string {
     const [ivHex, authTagHex, encryptedText] = text.split(':');
     const iv = Buffer.from(ivHex, 'hex');
     const authTag = Buffer.from(authTagHex, 'hex');
     const decipher = crypto.createDecipheriv('aes-256-gcm', OLD_ENCRYPTION_KEY, iv);
     decipher.setAuthTag(authTag);
     let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
     decrypted += decipher.final('utf8');
     return decrypted;
   }

   function encryptNew(text: string): string {
     const iv = crypto.randomBytes(16);
     const cipher = crypto.createCipheriv('aes-256-gcm', NEW_ENCRYPTION_KEY, iv);
     let encrypted = cipher.update(text, 'utf8', 'hex');
     encrypted += cipher.final('hex');
     const authTag = cipher.getAuthTag().toString('hex');
     return `${iv.toString('hex')}:${authTag}:${encrypted}`;
   }

   async function migrate() {
     const users = await prisma.user.findMany({
       where: { githubAccessToken: { not: null } },
     });

     console.log(`Found ${users.length} users with encrypted tokens`);

     for (const user of users) {
       try {
         // Decrypt with old key
         const decrypted = decryptOld(user.githubAccessToken);

         // Re-encrypt with new key
         const reencrypted = encryptNew(decrypted);

         // Update in database
         await prisma.user.update({
           where: { id: user.id },
           data: { githubAccessToken: reencrypted },
         });

         console.log(`✓ Migrated token for user ${user.username}`);
       } catch (error) {
         console.error(`✗ Failed to migrate token for user ${user.username}:`, error);
       }
     }

     console.log('Migration complete');
   }

   migrate()
     .then(() => process.exit(0))
     .catch((error) => {
       console.error('Migration failed:', error);
       process.exit(1);
     });
   ```

2. **Run the migration**:

   ```bash
   # Set your new ENCRYPTION_SALT (32 bytes for better security)
   export ENCRYPTION_SALT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

   # Run the migration script
   tsx migrate-encryption.ts
   ```

3. **Verify**:
   - Test that users can still access their GitHub repositories
   - Monitor logs for any decryption errors

## Security Recommendations

### Production Deployment

1. **Use a Secure Random Salt**:

   ```bash
   # Generate a cryptographically secure salt
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Store Securely**:
   - Use a secrets management service (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Never commit the actual salt value to version control
   - Use different salts for different environments (dev, staging, production)

3. **Key Rotation Strategy**:
   - Consider implementing key rotation for long-term security
   - Plan for periodic re-encryption of stored tokens
   - Document your key rotation process

### Better Long-term Solutions

For production environments, consider:

1. **Key Management Service (KMS)**:
   - AWS KMS
   - Google Cloud KMS
   - Azure Key Vault
   - HashiCorp Vault

2. **Envelope Encryption**:
   - Use KMS to encrypt data encryption keys
   - Rotate keys regularly
   - Separate key management from application logic

3. **OAuth Token Refresh**:
   - Store refresh tokens instead of access tokens when possible
   - Rotate access tokens regularly
   - Implement token expiration and renewal

## Testing

After migration, verify the encryption works correctly:

```bash
# Run the crypto tests
pnpm --filter api test crypto.test.ts

# Test the full API
pnpm --filter api test
```

## Rollback Plan

If issues occur during migration:

1. **Immediate Rollback**:
   - Revert to the previous code version
   - Existing encrypted tokens will work with hardcoded salt
   - Note: This restores the security vulnerability

2. **Re-attempt Migration**:
   - Fix any issues identified
   - Follow Option 1 (re-authentication) for safety

## Support

If you encounter issues during migration:

1. Check the application logs for decryption errors
2. Verify environment variables are set correctly
3. Test encryption/decryption with the test suite
4. Consider the re-authentication option if migration fails

## Verification Checklist

- [ ] Generated secure random salt
- [ ] Added `ENCRYPTION_SALT` to environment variables
- [ ] Added `ENCRYPTION_SALT` to production secrets management
- [ ] Decided on migration approach (re-auth vs token migration)
- [ ] Tested encryption/decryption after deployment
- [ ] Verified users can authenticate and access GitHub resources
- [ ] Documented the salt value in secure location
- [ ] Removed any temporary migration scripts from production
