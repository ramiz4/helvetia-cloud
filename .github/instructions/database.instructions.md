---
applyTo: 'packages/database/**/*.{ts,prisma}'
excludeAgent: ''
---

# Database & Prisma Instructions

## Prisma Schema Guidelines

### Schema Location

- Main schema: `packages/database/prisma/schema.prisma`
- This is a shared package used by API and Worker

### Schema Structure

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  services  Service[]
}
```

### Naming Conventions

- **Models**: PascalCase, singular (e.g., `User`, `Service`, `Deployment`)
- **Fields**: camelCase (e.g., `userId`, `createdAt`, `isActive`)
- **Relations**: camelCase, plural for one-to-many (e.g., `services`, `deployments`)
- **Enums**: PascalCase for enum name, UPPER_CASE for values
  ```prisma
  enum ServiceType {
    DOCKER
    STATIC
  }
  ```

### Field Types

- **IDs**: Use `String @id @default(cuid())` for user-facing IDs
- **Timestamps**: Always include `createdAt` and `updatedAt`
  ```prisma
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ```
- **Optional fields**: Use `?` for nullable fields
  ```prisma
  description String?
  ```
- **Unique constraints**: Add `@unique` or `@@unique([field1, field2])`
- **Foreign keys**: Explicitly name them
  ```prisma
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  ```

### Relations

- **One-to-many**:

  ```prisma
  model User {
    id       String    @id @default(cuid())
    services Service[]
  }

  model Service {
    id     String @id @default(cuid())
    userId String
    user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  }
  ```

- **One-to-one**:

  ```prisma
  model User {
    id      String   @id @default(cuid())
    profile Profile?
  }

  model Profile {
    id     String @id @default(cuid())
    userId String @unique
    user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  }
  ```

- **Many-to-many**: Use explicit join table

  ```prisma
  model Service {
    id   String           @id @default(cuid())
    tags ServiceOnTags[]
  }

  model Tag {
    id       String           @id @default(cuid())
    services ServiceOnTags[]
  }

  model ServiceOnTags {
    serviceId String
    tagId     String
    service   Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)
    tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

    @@id([serviceId, tagId])
  }
  ```

### Indexes & Performance

- Add indexes for frequently queried fields:

  ```prisma
  model Service {
    userId String
    status String

    @@index([userId])
    @@index([status])
    @@index([userId, status])
  }
  ```

- Add indexes for text fields (PostgreSQL):

  ```prisma
  model Service {
    name        String
    description String?

    @@index([name])
  }
  ```

### OnDelete Behavior

- Use `Cascade` when child records should be deleted with parent:
  ```prisma
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  ```
- Use `Restrict` to prevent deletion if relations exist
- Use `SetNull` to null out foreign keys (field must be optional)

## Workflow Commands

### Development

1. **Edit schema**: Modify `packages/database/prisma/schema.prisma`
2. **Create migration**: `pnpm migrate:dev`
   - Creates a new migration with your schema changes
   - Applies it to your local database
   - Generates Prisma Client
3. **Name your migration**: Use descriptive names (e.g., `add_user_email`, `create_notifications_table`)
4. **Review SQL**: Check `prisma/migrations/<timestamp>_<name>/migration.sql`
5. **Test changes**: Run tests to ensure migration works correctly
6. **Commit**: Add migration files to Git

### Production (Migrations)

1. **Apply migrations**: `pnpm migrate:deploy`
   - Applies all pending migrations to production database
   - Does not create new migrations
   - Safe for production use
2. **Generate client**: `pnpm generate`
   - Updates Prisma Client after migrations

### Migration Commands

```bash
# Create and apply a new migration (development)
pnpm migrate:dev

# Create migration without applying (for review)
pnpm migrate:create

# Apply pending migrations (production)
pnpm migrate:deploy

# Check migration status
pnpm migrate:status

# Reset database (⚠️ DESTRUCTIVE - dev only)
pnpm migrate:reset
```

**Important**:

- Use `migrate:dev` in development to create and test migrations
- Use `migrate:deploy` in production to apply migrations
- Never use `migrate:reset` in production
- Always review generated SQL before committing

### Legacy Command (Deprecated)

⚠️ `db:push` is deprecated and should not be used:

- No migration history
- Risk of data loss
- Not suitable for production
- Use `migrate:dev` instead

## Using Prisma Client

### Importing

```typescript
// In apps/api or apps/worker
import { prisma } from 'database';
```

### Basic Queries

```typescript
// Find all
const users = await prisma.user.findMany();

// Find with filter
const users = await prisma.user.findMany({
  where: { email: { contains: '@example.com' } },
});

// Find one
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Find first matching
const user = await prisma.user.findFirst({
  where: { email: userEmail },
});

// Create
const user = await prisma.user.create({
  data: { email, name },
});

// Update
const user = await prisma.user.update({
  where: { id: userId },
  data: { name: newName },
});

// Delete
await prisma.user.delete({
  where: { id: userId },
});

// Count
const count = await prisma.user.count();
```

### Relations

```typescript
// Include relations
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    services: true,
    deployments: true,
  },
});

// Select specific fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    services: {
      select: {
        id: true,
        name: true,
      },
    },
  },
});

// Nested writes
const user = await prisma.user.create({
  data: {
    email,
    services: {
      create: [
        { name: 'Service 1', type: 'DOCKER' },
        { name: 'Service 2', type: 'STATIC' },
      ],
    },
  },
});
```

### Transactions

```typescript
// Sequential operations (all or nothing)
await prisma.$transaction(async (tx) => {
  const service = await tx.service.create({
    data: { name, userId },
  });

  await tx.deployment.create({
    data: {
      serviceId: service.id,
      commitHash,
      status: 'PENDING',
    },
  });
});

// Independent operations (run in parallel)
const [users, services] = await prisma.$transaction([
  prisma.user.findMany(),
  prisma.service.findMany(),
]);
```

### Error Handling

```typescript
import { Prisma } from '@prisma/client';

try {
  await prisma.user.create({ data: { email } });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: Unique constraint violation
    if (error.code === 'P2002') {
      throw new Error('User already exists');
    }
    // P2025: Record not found
    if (error.code === 'P2025') {
      throw new Error('Record not found');
    }
  }
  throw error;
}
```

### Common Error Codes

- `P2002`: Unique constraint failed
- `P2003`: Foreign key constraint failed
- `P2025`: Record not found (e.g., in update/delete)
- `P2001`: Record searched for does not exist
- `P2014`: Relation violation

## Best Practices

### Performance

- **Use select**: Only fetch fields you need
- **Use pagination**: Avoid loading all records
  ```typescript
  const services = await prisma.service.findMany({
    take: 20,
    skip: page * 20,
    orderBy: { createdAt: 'desc' },
  });
  ```
- **Use indexes**: Add indexes to frequently queried fields
- **Batch operations**: Use `createMany`, `updateMany`, `deleteMany` when possible

### Type Safety

- Prisma generates TypeScript types automatically
- Use generated types:

  ```typescript
  import { User, Service, ServiceType } from '@prisma/client';

  function processService(service: Service) {
    // service is fully typed
  }
  ```

- Use Prisma's utility types:

  ```typescript
  import { Prisma } from '@prisma/client';

  type ServiceWithUser = Prisma.ServiceGetPayload<{
    include: { user: true };
  }>;
  ```

### Security

- **Never expose raw database errors** to clients
- **Always validate input** before queries (use Zod)
- **Use parameterized queries**: Prisma does this automatically
- **Avoid raw queries** unless absolutely necessary
  ```typescript
  // Use this sparingly
  await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`;
  ```

### Testing

- Use a separate test database
- Reset database between tests:

  ```typescript
  import { beforeEach } from 'vitest';

  beforeEach(async () => {
    await prisma.user.deleteMany();
    await prisma.service.deleteMany();
  });
  ```

## Common Mistakes to Avoid

- ❌ Forgetting to run `pnpm generate` after schema changes
- ❌ Not handling Prisma errors properly
- ❌ Loading relations without checking if needed (N+1 problem)
- ❌ Not using transactions for multi-step operations
- ❌ Exposing database errors to API clients
- ❌ Not adding indexes to frequently queried fields
- ❌ Using `any` type instead of Prisma-generated types
- ❌ Not using `select` to limit returned fields
