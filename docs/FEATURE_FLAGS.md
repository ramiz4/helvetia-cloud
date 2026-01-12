# Feature Flags

Feature flags allow you to enable or disable features in your application without deploying new code. This is useful for:

- **Gradual rollouts**: Release features to a subset of users first
- **A/B testing**: Test different features with different user groups
- **Kill switches**: Quickly disable problematic features
- **Beta features**: Let specific users try new features before general release

## Architecture

The feature flag system consists of:

1. **Database**: PostgreSQL table storing feature flag definitions
2. **API Service**: RESTful API for managing flags
3. **Dashboard**: Admin UI for creating and managing flags
4. **Client Library**: Utility for checking flags in the frontend

## API Endpoints

All endpoints are under `/api/v1/feature-flags`:

### Get All Flags

```http
GET /api/v1/feature-flags
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "key": "new_dashboard",
      "name": "New Dashboard UI",
      "description": "Enable the redesigned dashboard interface",
      "enabled": true,
      "segments": null,
      "createdAt": "2026-01-12T20:00:00.000Z",
      "updatedAt": "2026-01-12T20:00:00.000Z"
    }
  ]
}
```

### Get Flag by ID

```http
GET /api/v1/feature-flags/:id
Authorization: Bearer <token>
```

### Create Flag

```http
POST /api/v1/feature-flags
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "new_feature",
  "name": "New Feature",
  "description": "Description of the feature",
  "enabled": false,
  "segments": {
    "type": "percentage",
    "percentage": 10
  }
}
```

**Key Requirements:**

- Must contain only letters, numbers, underscores, and hyphens
- Must be unique
- Case-sensitive

### Update Flag

```http
PATCH /api/v1/feature-flags/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "enabled": true
}
```

### Toggle Flag

```http
POST /api/v1/feature-flags/:id/toggle
Authorization: Bearer <token>
```

Toggles the flag's enabled status (enabled ↔ disabled).

### Delete Flag

```http
DELETE /api/v1/feature-flags/:id
Authorization: Bearer <token>
```

### Check Flag Status

```http
POST /api/v1/feature-flags/check
Content-Type: application/json

{
  "key": "new_feature",
  "userId": "user-123"
}
```

**Response:**

```json
{
  "success": true,
  "enabled": true
}
```

**Note:** This endpoint is public (no authentication required) for easy client-side checks.

## A/B Testing with Segments

Feature flags support two types of segments for A/B testing:

### 1. User ID List

Enable the flag for specific users only:

```json
{
  "segments": {
    "type": "userIds",
    "userIds": ["user-1", "user-2", "user-3"]
  }
}
```

### 2. Percentage Rollout

Enable the flag for a percentage of users:

```json
{
  "segments": {
    "type": "percentage",
    "percentage": 25
  }
}
```

The system uses deterministic hashing to ensure the same user always gets the same result for a given flag. This means:

- Users won't flip between enabled/disabled states
- The rollout is consistent across sessions
- You can gradually increase the percentage over time

## Using Feature Flags

### Backend (API/Worker)

```typescript
import { resolve, TOKENS } from './di';
import { FeatureFlagService } from './services';

// Get the service
const featureFlagService = resolve<FeatureFlagService>(TOKENS.FeatureFlagService);

// Check if a flag is enabled
const enabled = await featureFlagService.isEnabled('new_feature');

// Check with user ID for A/B testing
const enabled = await featureFlagService.isEnabled('new_feature', userId);

// Use in code
if (enabled) {
  // New feature code
} else {
  // Old code
}
```

### Frontend (Dashboard)

#### Using the Hook

```typescript
import { useFeatureFlag } from '@/lib/featureFlags';

function MyComponent() {
  const { enabled, loading } = useFeatureFlag('new_dashboard', userId);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (enabled) {
    return <NewDashboard />;
  }

  return <OldDashboard />;
}
```

#### Using the Client Directly

```typescript
import { FeatureFlagClient } from '@/lib/featureFlags';

// Check single flag
const enabled = await FeatureFlagClient.isEnabled('new_feature', userId);

// Check multiple flags
const flags = await FeatureFlagClient.checkMultiple(
  ['feature_1', 'feature_2', 'feature_3'],
  userId,
);

if (flags.feature_1) {
  // Feature 1 code
}
```

## Admin UI

Access the feature flags admin panel at:

```
https://your-domain/admin/feature-flags
```

The admin UI allows you to:

- ✅ Create new feature flags
- ✅ Edit existing flags
- ✅ Toggle flags on/off with one click
- ✅ View flag status at a glance
- ✅ Delete flags
- ✅ Configure A/B testing segments

## Best Practices

### 1. Naming Conventions

- Use descriptive, lowercase keys: `new_dashboard`, `beta_feature`
- Use clear, user-friendly names in the UI
- Add descriptions explaining what the flag controls

### 2. Lifecycle Management

- **Development**: Create flag, keep disabled
- **Testing**: Enable for specific test users
- **Beta**: Enable for percentage rollout (10% → 25% → 50%)
- **General Release**: Enable for 100%
- **Cleanup**: Remove flag and related code after full rollout

### 3. Kill Switches

For critical features that might need emergency disabling:

```typescript
// Always check flags for potentially problematic features
if (await featureFlagService.isEnabled('payment_processing')) {
  await processPayment();
} else {
  await queuePaymentForLater();
}
```

### 4. Default Behavior

Always define what happens when a flag is disabled:

```typescript
if (enabled) {
  // New behavior
} else {
  // Safe fallback behavior
}
```

### 5. Performance

- Feature flag checks are fast (cached in memory where possible)
- The `/check` endpoint is optimized for client-side checks
- Consider checking flags once at app initialization rather than per request

## Database Schema

```sql
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "segments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");
CREATE INDEX "FeatureFlag_enabled_idx" ON "FeatureFlag"("enabled");
```

## Security Considerations

1. **Authentication**: All admin endpoints require authentication
2. **Public Check Endpoint**: The `/check` endpoint is public but only returns boolean status
3. **No Sensitive Data**: Avoid storing sensitive information in flag descriptions
4. **Audit Logging**: Consider adding audit logs for flag changes in production

## Testing

### Unit Tests

```typescript
import { FeatureFlagService } from './services/FeatureFlagService';
import { mockFeatureFlagRepository } from './test/mocks';

describe('FeatureFlagService', () => {
  it('should return false for unknown flags', async () => {
    const service = new FeatureFlagService(mockFeatureFlagRepository);
    const enabled = await service.isEnabled('unknown_flag');
    expect(enabled).toBe(false);
  });
});
```

### Integration Tests

```bash
# Create test flag
curl -X POST http://localhost:3001/api/v1/feature-flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"test_flag","name":"Test Flag","enabled":true}'

# Check flag
curl -X POST http://localhost:3001/api/v1/feature-flags/check \
  -H "Content-Type: application/json" \
  -d '{"key":"test_flag"}'
```

## Migration Guide

To enable feature flags in an existing deployment:

1. **Run Database Migration**:

   ```bash
   pnpm migrate:deploy
   ```

2. **Restart Services**:

   ```bash
   pnpm build
   pnpm start
   ```

3. **Verify Installation**:
   - Login to dashboard
   - Navigate to `/admin/feature-flags`
   - Create a test flag

4. **Start Using Flags**:
   - Wrap new features with flag checks
   - Gradually roll out to users
   - Remove flags after full rollout

## Troubleshooting

### Flag Not Found

**Problem**: API returns 404 for flag check  
**Solution**: Ensure the flag exists and the key is spelled correctly

### Flag Not Updating

**Problem**: Changes to flag don't take effect  
**Solution**: Check caching, restart services if needed

### A/B Testing Not Working

**Problem**: Users see inconsistent behavior  
**Solution**: Verify you're passing the same userId consistently

## Future Enhancements

Potential improvements for the feature flag system:

- [ ] Caching layer for faster checks
- [ ] Analytics/metrics for flag usage
- [ ] Time-based flag scheduling
- [ ] Environment-specific flags (dev/staging/prod)
- [ ] Flag dependency management
- [ ] Audit log for flag changes
- [ ] Webhook notifications on flag changes
