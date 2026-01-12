# API Versioning Strategy

## Overview

Helvetia Cloud uses **URL-based versioning** to manage API changes and ensure backward compatibility. All API endpoints are prefixed with a version identifier (e.g., `/api/v1`).

## Versioning Scheme

### Current Version: v1

All API endpoints are available under the `/api/v1` prefix:

```
https://api.helvetia.cloud/api/v1/services
https://api.helvetia.cloud/api/v1/deployments
https://api.helvetia.cloud/api/v1/projects
```

### Unversioned Endpoints

The following endpoints remain unversioned as they are infrastructure/monitoring endpoints:

- `/health` - Health check endpoint
- `/metrics` - Prometheus metrics
- `/metrics/json` - JSON metrics

## Version Negotiation

### Client Requirements

1. **All API clients MUST include the version prefix** in their requests
2. **Use the latest stable version** (currently v1) for all new integrations
3. **Specify the API version explicitly** - do not rely on defaults

### Example Requests

```bash
# Correct - versioned endpoint
curl https://api.helvetia.cloud/api/v1/services

# Incorrect - missing version
curl https://api.helvetia.cloud/services
```

### Frontend Configuration

The dashboard automatically uses the versioned API through the `API_BASE_URL` configuration:

```typescript
// apps/dashboard/src/lib/env.ts
export const API_BASE_URL = `${env.NEXT_PUBLIC_API_URL}/api/v1`;
```

All frontend API calls use this base URL:

```typescript
// Example service fetch
const response = await fetch(`${API_BASE_URL}/services`);
// Resolves to: http://localhost:3001/api/v1/services
```

## Version Lifecycle

### Version Support Policy

- **Active versions**: Receive new features, bug fixes, and security patches
- **Deprecated versions**: Receive security patches only
- **Sunset versions**: No longer supported

| Version | Status  | Release Date | Deprecation Date | Sunset Date |
| ------- | ------- | ------------ | ---------------- | ----------- |
| v1      | Active  | 2026-01-12   | TBD              | TBD         |
| v2      | Planned | TBD          | -                | -           |

### Deprecation Timeline

When a new version is released:

1. **Announcement**: Minimum 3 months before deprecation
2. **Deprecation**: Old version marked as deprecated, receives security patches only
3. **Sunset**: Minimum 6 months after deprecation, version is removed

### Breaking Changes Policy

- **v1**: Maintains backward compatibility, no breaking changes
- **Breaking changes require a new version** (e.g., v2)
- **Non-breaking changes** can be added to existing versions

#### Examples of Breaking Changes

These require a new version:

- Removing an endpoint or field
- Changing response format
- Changing authentication requirements
- Modifying required request parameters
- Changing default behavior

#### Examples of Non-Breaking Changes

These can be added to existing versions:

- Adding new endpoints
- Adding optional request parameters
- Adding new response fields
- Adding new error codes
- Performance improvements
- Bug fixes

## Version 2 Transition Path

### Planned v2 Features

The following breaking changes are planned for v2:

1. **Enhanced error responses** with standardized error codes
2. **Pagination standardization** across all list endpoints
3. **Webhook signature verification** changes
4. **Response envelope** for consistent API responses
5. **Rate limiting headers** standardization

### Migration Process

When v2 is released:

1. **v1 remains available** for at least 6 months
2. **Migration guide** will be published
3. **Parallel testing period** where both versions are available
4. **Gradual migration** encouraged, no forced upgrades
5. **Deprecation notices** added to v1 API responses

### Example Migration

```typescript
// v1 endpoint (current)
GET /api/v1/services
Response: [{ id: "123", name: "My Service", ... }]

// v2 endpoint (future)
GET /api/v2/services?page=1&limit=20
Response: {
  data: [{ id: "123", name: "My Service", ... }],
  pagination: { page: 1, limit: 20, total: 100 },
  meta: { version: "v2", timestamp: "2026-06-01T00:00:00Z" }
}
```

## Implementation Details

### Backend Structure

API routes are organized by version:

```
apps/api/src/routes/
├── v1/
│   └── index.ts          # v1 route aggregator
├── auth.routes.ts         # Auth endpoints
├── service.routes.ts      # Service endpoints
├── deployment.routes.ts   # Deployment endpoints
├── github.routes.ts       # GitHub integration
├── project.routes.ts      # Project endpoints
└── webhook.routes.ts      # Webhook endpoints
```

### Route Registration

Routes are registered with version prefix in `server.ts`:

```typescript
// Register API v1 routes under /api/v1 prefix
import { v1Routes } from './routes/v1';
fastify.register(v1Routes, { prefix: '/api/v1' });
```

### Authentication

JWT authentication works across all versioned endpoints. The auth middleware recognizes versioned public routes:

```typescript
const publicRoutes = [
  '/api/v1/webhooks/github',
  '/api/v1/auth/github',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
];
```

## Best Practices

### For API Clients

1. **Always use versioned endpoints** - specify the version explicitly
2. **Handle version deprecation** - monitor deprecation notices
3. **Test against new versions early** - use beta/preview versions
4. **Implement graceful fallback** - handle version not found errors
5. **Update dependencies regularly** - use latest SDK/client library versions

### For API Developers

1. **Never break v1 compatibility** - add new endpoints for breaking changes
2. **Document all changes** - update API documentation for every change
3. **Test backward compatibility** - run regression tests before releases
4. **Communicate deprecations** - announce deprecations early and clearly
5. **Maintain version matrix** - track which features are in which versions

## Monitoring and Metrics

### Version Usage Tracking

API metrics include version information:

```
http_requests_total{version="v1", method="GET", route="/services"} 1234
```

### Deprecation Warnings

When using deprecated versions, responses include warning headers:

```
Deprecation: version="v1" date="2026-12-31"
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
```

## FAQ

### Q: Do I need to update all my API calls immediately?

**A:** No. v1 will remain supported for at least 6 months after v2 is released. However, we recommend updating to use explicit versioning as soon as possible.

### Q: What happens if I don't specify a version?

**A:** The API will return a 404 error. All clients must use versioned endpoints.

### Q: Can I use multiple versions simultaneously?

**A:** Yes. You can call different versions in parallel during migration periods.

### Q: How do I know when a version is deprecated?

**A:** Deprecation is announced via:

- Email notifications to registered developers
- Deprecation headers in API responses
- GitHub repository announcements
- Documentation updates

### Q: What if I find a bug in an older version?

**A:** Security bugs in deprecated versions receive patches. Other bugs should be fixed by upgrading to the latest version.

## References

- [API Documentation](https://docs.helvetia.cloud/api)
- [REST API Best Practices](https://restfulapi.net/versioning/)
- [Semantic Versioning](https://semver.org/)
- [Deprecation RFC](https://datatracker.ietf.org/doc/html/rfc8594)

## Change Log

| Date       | Version | Changes                                 |
| ---------- | ------- | --------------------------------------- |
| 2026-01-12 | v1      | Initial versioning strategy implemented |
