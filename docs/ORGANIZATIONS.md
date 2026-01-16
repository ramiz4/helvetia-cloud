# Organizations & Team Collaboration

## Overview

Helvetia Cloud supports organizations to enable team collaboration. Users can create organizations, invite members, and assign roles with different permission levels.

## Roles & Permissions

### Role Hierarchy

Roles are organized in a hierarchy where higher roles have all permissions of lower roles:

```
OWNER > ADMIN > DEVELOPER > MEMBER > VIEWER
```

### Role Definitions

#### OWNER

- Full administrative access
- Can manage all organization settings
- Can add/remove/update members with any role
- Can delete the organization
- Cannot be removed if they are the last owner
- **Use Case**: Organization founders, primary administrators

#### ADMIN

- Can manage members (add, update, remove)
- Can manage organization settings
- Can create and manage services
- Can perform deployments
- **Use Case**: Team leads, senior developers with administrative responsibilities

#### DEVELOPER

- Can create and manage services
- Can perform deployments
- Can view organization members
- Cannot manage members or organization settings
- **Use Case**: Active contributors who deploy and manage services

#### MEMBER

- Can view services
- Can view deployments
- Limited write access to services
- Cannot perform deployments
- **Use Case**: Team members who need visibility but limited control

#### VIEWER

- Read-only access
- Can view organization details
- Can view services and deployments
- Cannot make any changes
- **Use Case**: Stakeholders, observers, read-only access

## API Endpoints

### Organization Management

#### Create Organization

```http
POST /organizations
Content-Type: application/json

{
  "name": "My Organization"
}
```

Response:

```json
{
  "id": "org-123",
  "name": "My Organization",
  "slug": "my-organization",
  "avatar": null,
  "createdAt": "2026-01-16T18:30:00Z",
  "updatedAt": "2026-01-16T18:30:00Z"
}
```

#### List Organizations

```http
GET /organizations
```

Returns all organizations where the authenticated user is a member.

#### Get Organization

```http
GET /organizations/:id
```

Returns organization details including members (requires membership).

### Member Management

#### Add Member

```http
POST /organizations/:id/members
Content-Type: application/json

{
  "userId": "user-456",
  "role": "DEVELOPER"
}
```

**Required Role**: ADMIN or OWNER

#### Update Member Role

```http
PATCH /organizations/:id/members/:userId
Content-Type: application/json

{
  "role": "ADMIN"
}
```

**Required Role**: ADMIN or OWNER

**Restrictions**:

- Cannot change the role of the last owner
- Must have ADMIN or OWNER role

#### Remove Member

```http
DELETE /organizations/:id/members/:userId
```

**Required Role**: ADMIN or OWNER (or the member themselves)

**Restrictions**:

- Cannot remove the last owner
- Members can remove themselves

## RBAC Middleware

The API provides middleware functions for route-level access control:

### `requireOrganizationRole(allowedRoles: Role[])`

Checks if the user has one of the specified roles in the organization.

```typescript
import { Role } from 'database';
import { requireOrganizationRole } from '../middleware';

fastify.post(
  '/organizations/:id/members',
  { preHandler: [requireOrganizationRole([Role.OWNER, Role.ADMIN])] },
  handler,
);
```

### `requireOrganizationPermission(minimumRole: Role)`

Checks if the user has at least the specified permission level using the role hierarchy.

```typescript
import { Role } from 'database';
import { requireOrganizationPermission } from '../middleware';

// Only ADMIN and OWNER can access
fastify.post(
  '/organizations/:id/settings',
  { preHandler: [requireOrganizationPermission(Role.ADMIN)] },
  handler,
);

// DEVELOPER, ADMIN, and OWNER can access
fastify.post(
  '/organizations/:id/services',
  { preHandler: [requireOrganizationPermission(Role.DEVELOPER)] },
  handler,
);
```

## Frontend Components

### Organization Switcher

Located at: `apps/dashboard/src/components/OrganizationSwitcher.tsx`

Displays the current organization and allows switching between organizations. Automatically saves the selected organization to localStorage.

### Organization Context

Located at: `apps/dashboard/src/lib/OrganizationContext.tsx`

Provides organization state management across the application:

```typescript
import { useOrganizationContext } from '@/lib/OrganizationContext';

function MyComponent() {
  const { currentOrganization, setCurrentOrganization } = useOrganizationContext();

  return <div>{currentOrganization?.name}</div>;
}
```

### Member Management

Located at: `apps/dashboard/src/components/organizations/MemberManagement.tsx`

Provides UI for:

- Adding members
- Updating member roles
- Removing members
- Viewing member list

## Database Schema

### Organization

```prisma
model Organization {
  id        String               @id @default(uuid())
  name      String
  slug      String               @unique
  avatar    String?
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt
  members   OrganizationMember[]
  projects  Project[]
}
```

### OrganizationMember

```prisma
model OrganizationMember {
  id             String       @id @default(uuid())
  organizationId String
  userId         String
  role           Role         @default(MEMBER)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
}
```

### Role Enum

```prisma
enum Role {
  OWNER
  ADMIN
  DEVELOPER
  MEMBER
  VIEWER
}
```

## Best Practices

### Organization Creation

- Organization slugs are auto-generated from the name
- If a slug conflict occurs, a random suffix is added
- The creator is automatically added as OWNER

### Member Management

- Always have at least one OWNER
- Use ADMIN role for trusted team members who need to manage the team
- Use DEVELOPER role for contributors who deploy services
- Use MEMBER for visibility without deployment permissions
- Use VIEWER for stakeholders who need read-only access

### Permission Checks

- Always use middleware for route-level protection
- Use service-layer checks for business logic
- Check permissions before allowing destructive operations

## Migration Guide

### For Existing Users

When organizations are enabled, existing users maintain their personal accounts. To migrate services to an organization:

1. Create an organization
2. Invite team members
3. (Future) Use the service transfer feature to move services to the organization

### For New Users

New users can:

1. Create their first organization immediately
2. Start with personal projects
3. Create organizations as needed for team collaboration

## Testing

### Middleware Tests

Located at: `apps/api/src/middleware/organization.middleware.test.ts`

Tests verify:

- Role-based access control
- Permission hierarchy
- Non-member rejection
- Invalid ID handling

### Service Tests

Located at: `apps/api/src/services/OrganizationService.test.ts`

Tests verify:

- Organization creation
- Member management
- Permission checks
- Edge cases (last owner, role updates)

## Future Enhancements

### Planned Features

- Email invitation system
- Audit logging for organization actions
- Service transfer between personal and organization accounts
- Advanced permission management (custom roles)
- Organization billing and settings
- Organization activity feed
- Member activity tracking

### Not Yet Implemented

- Invitation tokens
- Email notifications
- Service-level permissions (in progress)
- Deployment permissions (in progress)
- Audit logs
- Service transfers
