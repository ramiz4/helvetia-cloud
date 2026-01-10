# Database Migrations Guide

This document provides comprehensive guidance on using Prisma Migrate for database schema management in Helvetia Cloud.

## Table of Contents

- [Overview](#overview)
- [Why Prisma Migrate?](#why-prisma-migrate)
- [Migration Workflow](#migration-workflow)
- [Common Commands](#common-commands)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Rollback Procedures](#rollback-procedures)
- [Team Collaboration](#team-collaboration)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

Helvetia Cloud uses **Prisma Migrate** for managing database schema changes. Prisma Migrate provides:

- ✅ **Migration History**: Track all schema changes over time
- ✅ **Data Safety**: Review migrations before applying them
- ✅ **Rollback Support**: Revert problematic migrations
- ✅ **Team Collaboration**: Share schema changes via version control
- ✅ **Production Safety**: Apply migrations reliably in production

**Migration Location**: `/packages/database/prisma/migrations/`

---

## Why Prisma Migrate?

### Problems with `db:push`

The previous approach (`pnpm db:push`) had several issues:

- ❌ **No Migration History**: Cannot track what changed and when
- ❌ **Data Loss Risk**: Direct schema pushes can drop columns/tables without warning
- ❌ **No Rollback**: Cannot undo changes if something goes wrong
- ❌ **Team Conflicts**: Difficult to coordinate schema changes across team members
- ❌ **Production Danger**: Not suitable for production environments

### Benefits of Prisma Migrate

- ✅ **Version Control**: Migrations are committed to Git
- ✅ **Reviewable**: Team can review SQL before applying
- ✅ **Incremental**: Apply changes step-by-step
- ✅ **Safe**: Preview changes before applying
- ✅ **Auditable**: Full history of schema evolution

---

## Migration Workflow

### High-Level Process

```
1. Modify schema.prisma
2. Create migration (SQL files generated)
3. Review generated SQL
4. Apply migration to dev database
5. Test changes locally
6. Commit migration files to Git
7. Deploy to production
```

### Migration File Structure

```
packages/database/prisma/migrations/
├── migration_lock.toml           # Database provider lock
├── 20260110183919_init/          # Initial migration
│   └── migration.sql             # SQL statements
├── 20260110184500_add_user_email/
│   └── migration.sql
└── ...
```

---

## Common Commands

### Root Level (Recommended)

These commands run migrations from the project root:

```bash
# Create a new migration (development)
pnpm migrate:dev

# Create migration without applying (review first)
pnpm migrate:create

# Apply pending migrations (production)
pnpm migrate:deploy

# Check migration status
pnpm migrate:status

# Reset database (⚠️ DESTRUCTIVE - dev only)
pnpm migrate:reset
```

### Database Package Level

Run from `packages/database/`:

```bash
# Development migration
pnpm migrate:dev

# Production deployment
pnpm migrate:deploy

# Check status
pnpm migrate:status

# Reset (dev only)
pnpm migrate:reset
```

---

## Development Workflow

### 1. Making Schema Changes

Edit `packages/database/prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique  // ✅ Add new field
  // ... other fields
}
```

### 2. Create Migration

```bash
pnpm migrate:dev
```

You'll be prompted to name your migration:

```
✔ Enter a name for the new migration: › add_user_email
```

**Naming Convention**: Use lowercase with underscores, be descriptive:

- ✅ `add_user_email`
- ✅ `create_notifications_table`
- ✅ `add_deployment_indexes`
- ❌ `update` (too vague)
- ❌ `AddUserEmail` (not lowercase)

### 3. Review Generated SQL

Check the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "email" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
```

**Important**: Always review the SQL to ensure:

- No unintended data loss
- Indexes are created for performance
- Constraints are correct
- Migration is safe to apply

### 4. Test Locally

The migration is automatically applied to your local database. Test the changes:

```bash
# Run API tests
pnpm --filter api test

# Run Worker tests
pnpm --filter worker test

# Manual testing
pnpm dev
```

### 5. Commit to Version Control

```bash
git add packages/database/prisma/migrations/
git commit -m "feat(database): add email field to User model"
git push
```

---

## Production Deployment

### Manual Deployment

For production servers, run migrations before starting the application:

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
pnpm install

# 3. Apply pending migrations
pnpm migrate:deploy

# 4. Generate Prisma Client
pnpm generate

# 5. Build application
pnpm build

# 6. Start services
pnpm start
```

### Docker Deployment

Update your Dockerfile to run migrations on container start:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/database ./packages/database

# Run migrations and start app
CMD ["sh", "-c", "cd packages/database && pnpm migrate:deploy && cd ../.. && pnpm start"]
```

### CI/CD Pipeline

The GitHub Actions workflow automatically applies migrations:

```yaml
- name: Run database migrations
  run: pnpm migrate:deploy
```

**Environment Variable**: Ensure `DATABASE_URL` is set correctly for your environment.

---

## Rollback Procedures

Prisma Migrate does not have a built-in rollback command. Here's how to handle rollbacks:

### Option 1: Manual Rollback (Recommended)

1. **Identify the problematic migration**:

   ```bash
   pnpm migrate:status
   ```

2. **Create a new migration that reverses the changes**:

   For example, if migration `add_user_email` added a column:

   ```bash
   # Edit schema.prisma to remove the email field
   # Then create a new migration
   pnpm migrate:dev
   # Name it: remove_user_email
   ```

3. **Apply the rollback migration**:
   ```bash
   pnpm migrate:deploy
   ```

### Option 2: Database Restore (Critical Issues)

If a migration caused critical issues:

1. **Stop the application**:

   ```bash
   docker-compose down
   ```

2. **Restore database from backup**:

   ```bash
   psql $DATABASE_URL < backup.sql
   ```

3. **Reset migration state** (if needed):

   ```sql
   DELETE FROM "_prisma_migrations" WHERE migration_name = '<problematic_migration>';
   ```

4. **Restart services**:
   ```bash
   docker-compose up -d
   ```

### Option 3: Development Reset (Dev Only)

⚠️ **DESTRUCTIVE** - Only use in development:

```bash
pnpm migrate:reset
```

This will:

- Drop the database
- Recreate it
- Apply all migrations from scratch
- Run seed scripts (if configured)

---

## Team Collaboration

### Working with Multiple Developers

**Scenario**: Two developers create migrations simultaneously.

1. **Developer A** creates migration `add_user_bio`:

   ```bash
   git checkout -b feat/user-bio
   # Edit schema.prisma
   pnpm migrate:dev
   git commit -am "feat: add user bio"
   git push
   ```

2. **Developer B** creates migration `add_user_phone`:

   ```bash
   git checkout -b feat/user-phone
   # Edit schema.prisma
   pnpm migrate:dev
   git commit -am "feat: add user phone"
   git push
   ```

3. **Developer A merges first** to `main`

4. **Developer B pulls latest**:

   ```bash
   git pull origin main
   # Resolve conflicts in schema.prisma
   pnpm migrate:dev  # Creates new migration resolving differences
   ```

### Best Practices for Teams

- ✅ **Pull before creating migrations**: Always pull latest code first
- ✅ **Communicate schema changes**: Notify team when making major changes
- ✅ **Review migrations in PRs**: Always review generated SQL in code reviews
- ✅ **Test migrations locally**: Ensure migrations work before pushing
- ✅ **Keep migrations small**: Make incremental, focused changes

---

## Troubleshooting

### Migration Failed to Apply

**Error**: Migration failed with SQL error

**Solution**:

1. Check the error message in terminal
2. Review the migration SQL file
3. Fix the issue in `schema.prisma`
4. Delete the failed migration folder
5. Recreate the migration with `pnpm migrate:dev`

### Drift Detected

**Error**: "Drift detected: Your database schema is not in sync with your migration history."

**Cause**: Manual changes were made to the database outside of migrations.

**Solution**:

```bash
# Option 1: Generate a new migration to capture the drift
pnpm migrate:dev

# Option 2: Reset database (dev only)
pnpm migrate:reset
```

### Migration Already Applied

**Error**: "Migration `<name>` has already been applied."

**Solution**: This is expected if migration was already applied. Use `pnpm migrate:status` to check.

### Database Connection Issues

**Error**: "Can't reach database server"

**Solution**:

1. Ensure PostgreSQL is running:
   ```bash
   docker-compose up -d postgres
   ```
2. Check `DATABASE_URL` environment variable
3. Verify database credentials

---

## Best Practices

### Schema Changes

- ✅ **Make backward-compatible changes** when possible
- ✅ **Add columns as nullable first**, then backfill data, then make required
- ✅ **Create indexes in separate migrations** for large tables
- ✅ **Use transactions** for complex multi-step migrations
- ❌ **Avoid renaming columns directly** (create new, copy data, drop old)
- ❌ **Don't mix data migrations with schema migrations**

### Migration Naming

Use descriptive, lowercase names with underscores:

- ✅ `create_notifications_table`
- ✅ `add_user_email_index`
- ✅ `add_cascade_delete_to_services`
- ❌ `update`
- ❌ `fix`
- ❌ `changes`

### Data Migrations

For migrations that require data transformations:

1. **Create schema migration** first
2. **Run data migration script** separately (in `prisma/seed.ts` or custom script)
3. **Add constraints** in a follow-up migration

Example:

```sql
-- Migration 1: Add nullable column
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- Migration 2: (After backfilling data) Make it required
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
```

### Testing Migrations

- ✅ Test on a staging database first
- ✅ Run tests after applying migration
- ✅ Verify data integrity
- ✅ Check query performance
- ✅ Monitor application logs

### Production Safety

- ✅ **Backup database** before deploying migrations
- ✅ **Apply during maintenance window** for large changes
- ✅ **Monitor application** after deployment
- ✅ **Have rollback plan ready**
- ✅ **Use database transactions** when possible

---

## Additional Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## Need Help?

- Check `pnpm migrate:status` for current state
- Review migration SQL files in `prisma/migrations/`
- Consult team lead for complex schema changes
- See `.github/instructions/database.instructions.md` for coding guidelines
