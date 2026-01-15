# Password Security Implementation

## Overview

This document describes the password hashing and security implementation for Helvetia Cloud's authentication system.

## Security Measures

### Password Hashing Algorithm

We use **bcrypt** for password hashing with the following configuration:

- **Algorithm**: bcrypt (based on Blowfish cipher)
- **Salt Rounds**: 12 (provides strong security while maintaining reasonable performance)
- **Auto-salting**: Each password is automatically salted with a unique random value

### Why bcrypt?

1. **Intentionally Slow**: bcrypt is designed to be computationally expensive, making brute-force attacks impractical
2. **Adaptive**: The cost factor can be increased over time as hardware becomes faster
3. **Built-in Salt**: Each password hash includes its own random salt, preventing rainbow table attacks
4. **Battle-tested**: Industry standard with proven security track record

### Key Features

- **Unique Salts**: Each password generates a different hash even if the plaintext is identical
- **No Plaintext Storage**: Passwords are never stored in plaintext
- **Secure Verification**: Password verification is done using constant-time comparison
- **Migration Support**: Legacy SHA-256 hashes are automatically upgraded to bcrypt on next login

## Implementation Details

### Password Hashing

Located in `apps/api/src/utils/password.ts`:

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}
```

**Example Output**:

```
Input:  "myPassword123"
Output: "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW"
```

### Password Verification

```typescript
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

The verification process:

1. Extracts the salt from the stored hash
2. Hashes the input password with the extracted salt
3. Compares the result using constant-time comparison

### Legacy Hash Detection

```typescript
function isLegacyHash(hash: string): boolean {
  const isBcryptHash = /^\$2[aby]\$/.test(hash);
  const isSHA256Hash = /^[a-f0-9]{64}$/i.test(hash);
  return !isBcryptHash && isSHA256Hash;
}
```

Identifies passwords hashed with the old SHA-256 algorithm (64-character hex strings).

## Migration Strategy

### Automatic Migration on Login

When a user with a legacy SHA-256 hash logs in:

1. Verify the password using legacy SHA-256 method
2. If correct, immediately re-hash with bcrypt
3. Update the database with the new bcrypt hash
4. Complete the authentication

**Implementation** (`apps/api/src/services/AuthenticationService.ts`):

```typescript
if (isLegacyHash(user.password)) {
  // Verify using legacy SHA-256
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  if (user.password !== hashedPassword) {
    throw new UnauthorizedError('Invalid username or password');
  }

  // Migrate to bcrypt
  const newHash = await hashPassword(password);
  await this.userRepository.update(user.id, { password: newHash });
} else {
  // Use bcrypt verification
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    throw new UnauthorizedError('Invalid username or password');
  }
}
```

### Admin User Initialization

The admin user password is always hashed with bcrypt during initialization (`apps/api/src/services/InitializationService.ts`):

```typescript
const hashedPassword = await hashPassword(adminPassword);

// Check if existing admin has legacy hash
const needsPasswordMigration = existingAdmin.password && isLegacyHash(existingAdmin.password);

if (needsPasswordMigration) {
  // Force update to new bcrypt hash
  await this.userRepository.update(existingAdmin.id, {
    username: adminUsername,
    password: hashedPassword,
    role: Role.ADMIN,
  });
}
```

## Password Requirements

### Current Implementation

- No minimum length enforced at the authentication service level
- Validation should be added at the API route level using Zod schemas

### Recommended Requirements

For production deployments, implement these requirements:

```typescript
// Example password validation schema
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');
```

## Performance Considerations

### Bcrypt Cost Factor (Salt Rounds)

- **Current Setting**: 12 rounds
- **Hashing Time**: ~200-400ms per password (depending on hardware)
- **Trade-off**: Higher values increase security but also increase login time

### Tuning Guidelines

- **10 rounds**: Fast, minimum recommended for production (~100ms)
- **12 rounds**: Current setting, good balance (~300ms)
- **14 rounds**: High security for sensitive systems (~1200ms)

To adjust: Change `SALT_ROUNDS` constant in `apps/api/src/utils/password.ts`

## Security Best Practices

### Do's ✅

1. **Use bcrypt** for all new password hashing
2. **Never log passwords** or password hashes
3. **Use HTTPS** for all authentication endpoints
4. **Implement rate limiting** on login attempts
5. **Store passwords** only in hashed form
6. **Rotate secrets** regularly (JWT secrets, encryption keys)

### Don'ts ❌

1. ❌ Don't use SHA-256 or MD5 for password hashing
2. ❌ Don't implement custom hashing algorithms
3. ❌ Don't store passwords in plaintext
4. ❌ Don't transmit passwords over unencrypted connections
5. ❌ Don't include passwords in logs or error messages
6. ❌ Don't use the same salt for multiple passwords

## Testing

### Unit Tests

Comprehensive tests are located in:

- `apps/api/src/utils/password.test.ts` - Password utility functions
- `apps/api/src/services/AuthenticationService.test.ts` - Authentication with migration
- `apps/api/src/services/InitializationService.test.ts` - Admin initialization

### Test Coverage

- ✅ Password hashing generates valid bcrypt hashes
- ✅ Same password produces different hashes (unique salts)
- ✅ Password verification works correctly
- ✅ Legacy hash detection identifies SHA-256 hashes
- ✅ Legacy hash migration on login
- ✅ Admin password initialization with bcrypt
- ✅ Special characters and edge cases handled

## Related Files

### Core Implementation

- `apps/api/src/utils/password.ts` - Password hashing utilities
- `apps/api/src/services/AuthenticationService.ts` - Authentication with migration
- `apps/api/src/services/InitializationService.ts` - Admin user initialization

### Tests

- `apps/api/src/utils/password.test.ts`
- `apps/api/src/services/AuthenticationService.test.ts`
- `apps/api/src/services/InitializationService.test.ts`

### Configuration

- `packages/database/prisma/schema.prisma` - User model with password field

## References

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [bcrypt npm package](https://www.npmjs.com/package/bcrypt)
- [bcrypt algorithm specification](https://en.wikipedia.org/wiki/Bcrypt)
