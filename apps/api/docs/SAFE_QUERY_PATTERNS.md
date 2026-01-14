# Safe Prisma Query Patterns

This document outlines safe patterns for writing Prisma queries in the Helvetia Cloud API to prevent SQL injection and other security vulnerabilities.

## Repository URL Queries

### ❌ Unsafe Pattern (DO NOT USE)

```typescript
// UNSAFE: Using contains with unsanitized user input
const services = await prisma.service.findMany({
  where: {
    repoUrl: { contains: userProvidedUrl }, // Can match unintended records
  },
});
```

**Problems:**

- `contains` performs substring matching which can match unintended records
- Repository URLs may have `.git` suffix inconsistencies
- Not vulnerable to SQL injection (Prisma protects against that) but can cause logical bugs

### ✅ Safe Pattern (RECOMMENDED)

```typescript
import { getRepoUrlMatchCondition } from './utils/repoUrl';

// SAFE: Using exact match with OR condition
const services = await prisma.service.findMany({
  where: {
    ...getRepoUrlMatchCondition(userProvidedUrl),
    // This expands to:
    // OR: [
    //   { repoUrl: normalizedUrl },
    //   { repoUrl: `${normalizedUrl}.git` }
    // ]
  },
});
```

**Benefits:**

- Normalizes URLs by trimming whitespace and removing `.git` suffix
- Uses exact matching with OR conditions to handle both variants
- Prevents unintended substring matches
- Type-safe and tested

## Utility Functions

### `normalizeRepoUrl(url: string): string`

Normalizes a repository URL by trimming whitespace and removing `.git` suffix.

```typescript
normalizeRepoUrl('  https://github.com/user/repo.git  ');
// Returns: 'https://github.com/user/repo'
```

### `getRepoUrlMatchCondition(repoUrl: string)`

Generates a Prisma query condition for matching repository URLs, handling both with and without `.git` suffix.

```typescript
getRepoUrlMatchCondition('https://github.com/user/repo');
// Returns: {
//   OR: [
//     { repoUrl: 'https://github.com/user/repo' },
//     { repoUrl: 'https://github.com/user/repo.git' }
//   ]
// }
```

## General Security Guidelines

### Input Validation

Always validate user input before using it in database queries:

```typescript
import { z } from 'zod';

const repoSchema = z.object({
  repoUrl: z.url().max(500),
  branch: z.string().min(1).max(100),
});

// Validate before querying
const validated = repoSchema.parse(userInput);
```

### String Operators

Be cautious with these Prisma string operators:

- `contains`: Use only with exact, validated strings (avoid user input)
- `startsWith`: Validate input format before use
- `endsWith`: Validate input format before use
- `equals`: Safe to use (exact match)
- `in`: Safe when input is validated

### Recommended Patterns

1. **Exact Matches**: Prefer exact equality (`equals` or direct match)
2. **Enums**: Use TypeScript enums for fixed values
3. **Validation**: Always validate with Zod before database queries
4. **Normalization**: Normalize user input (trim, lowercase, etc.)
5. **Whitelisting**: When possible, whitelist acceptable values

## Migration Guide

If you find code using unsafe patterns, follow these steps:

1. **Identify unsafe usage**:

   ```bash
   grep -r "contains.*repoUrl" apps/api/src/
   ```

2. **Import the utility**:

   ```typescript
   import { getRepoUrlMatchCondition } from './utils/repoUrl';
   ```

3. **Replace the query**:

   ```typescript
   // Before
   where: {
     repoUrl: { contains: repoUrl }
   }

   // After
   where: {
     ...getRepoUrlMatchCondition(repoUrl)
   }
   ```

4. **Add tests** to verify the fix works correctly

## References

- [Prisma Query API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#filter-conditions-and-operators)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [Input Validation with Zod](https://zod.dev/)

## Audit Checklist

When reviewing code for security:

- [ ] No `contains` operators with unsanitized user input
- [ ] All user inputs are validated with Zod schemas
- [ ] Repository URLs use `getRepoUrlMatchCondition` utility
- [ ] No raw SQL queries (use Prisma's query builder)
- [ ] Sensitive data (tokens, passwords) never logged
- [ ] Authentication checks on all protected routes
