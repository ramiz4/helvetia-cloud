# API Documentation

This directory contains API-specific documentation for the Helvetia Cloud API service.

## Getting Started

- **[API Getting Started Guide](./API_GETTING_STARTED.md)** ⭐ - Quick start guide with authentication, examples, and best practices
- **[Interactive API Documentation](http://localhost:3001/api/v1/docs)** - Swagger UI for trying out endpoints (dev environment)

## API Reference

### Core API Documentation

- **[API_VERSIONING.md](./API_VERSIONING.md)** - API versioning strategy and version negotiation
- **[API_CHANGELOG.md](./API_CHANGELOG.md)** - Version history and breaking changes
- **[ERROR_CODES.md](./ERROR_CODES.md)** - Comprehensive error code reference
- **[REQUEST_TRACING.md](./REQUEST_TRACING.md)** - Request ID tracing across services
- **[TESTING.md](./TESTING.md)** ⭐ - Comprehensive testing guide with mocking patterns and best practices

### Configuration & Limits

- **[BODY_SIZE_LIMITS.md](./BODY_SIZE_LIMITS.md)** - Request body size limits and configuration
- **[SAFE_QUERY_PATTERNS.md](./SAFE_QUERY_PATTERNS.md)** - Safe Prisma query patterns

### Security & Authentication

- **[SECURITY.md](./SECURITY.md)** - Security guidelines, authentication, and token management
- **[PASSWORD_SECURITY.md](./PASSWORD_SECURITY.md)** - Password hashing and security best practices

### Observability

- **[LOGGING.md](./LOGGING.md)** - Logging patterns and best practices
- **[METRICS.md](./METRICS.md)** - Prometheus metrics and monitoring
- **[SSE_AND_STATUS_MANAGEMENT.md](./SSE_AND_STATUS_MANAGEMENT.md)** - Server-Sent Events, memory leak prevention, and distributed status management

### Architecture & Implementation

- **[DI_IMPLEMENTATION_SUMMARY.md](./DI_IMPLEMENTATION_SUMMARY.md)** - Dependency injection framework implementation
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Guide for adopting dependency injection
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - API implementation details
- **[TYPE_PATTERNS.md](./TYPE_PATTERNS.md)** - TypeScript patterns and type safety
- **[TYPE_SAFETY_IMPROVEMENTS.md](./TYPE_SAFETY_IMPROVEMENTS.md)** - Type safety improvements

## API Endpoints Overview

### Authentication (`/api/v1/auth`)

- GitHub OAuth authentication
- Email/password login
- Token refresh and logout
- User profile management

### Services (`/api/v1/services`)

- Service CRUD operations
- Health checks and metrics
- Delete protection
- Real-time metrics streaming

### Deployments (`/api/v1/services/:id/deploy`, `/api/v1/deployments`)

- Trigger deployments
- Restart/stop services
- Deployment logs and history
- Real-time log streaming

### Projects (`/api/v1/projects`)

- Project management
- Environment creation
- Multi-environment support

### Organizations (`/api/v1/organizations`)

- Organization CRUD
- Member management
- Role-based access control (OWNER, ADMIN, MEMBER)

### GitHub Integration (`/api/v1/github`)

- List organizations and repositories
- Get repository branches
- Access container packages
- GitHub API proxy

### Webhooks (`/api/v1/webhooks`)

- GitHub webhook handler
- Automated deployments on push
- Pull request preview deployments

### Feature Flags (`/api/v1/feature-flags`)

- Feature flag management (admin)
- Public feature flag checks
- Bulk feature flag evaluation

### Monitoring

- Health checks (`/health`)
- Prometheus metrics (`/metrics`, `/metrics/json`)

## Quick Links

- **Production API**: `https://api.helvetia.cloud/api/v1`
- **Production Docs**: `https://api.helvetia.cloud/api/v1/docs`
- **Development API**: `http://localhost:3001/api/v1`
- **Development Docs**: `http://localhost:3001/api/v1/docs`

## Code Examples

See the [API Getting Started Guide](./API_GETTING_STARTED.md) for complete code examples in:

- cURL
- JavaScript/Node.js
- Python

## Rate Limiting

| Endpoint Type  | Limit                          |
| -------------- | ------------------------------ |
| Global         | 100 requests/minute per IP     |
| Authentication | 5 requests/minute per IP       |
| Deployments    | 10 requests/minute per user    |
| Webhooks/SSE   | 20 connections/minute per user |
| Feature Flags  | 30 requests/minute per IP      |

See [API Getting Started Guide](./API_GETTING_STARTED.md#rate-limiting) for details.

## Authentication

The API uses JWT tokens for authentication:

- **Access Token**: 15 minutes lifetime
- **Refresh Token**: 7 days lifetime

See [Security Documentation](./SECURITY.md) and [Getting Started Guide](./API_GETTING_STARTED.md#authentication) for details.

## Versioning

Current version: **v1** (`/api/v1/`)

- Breaking changes require new major version
- Old versions supported for 6+ months
- Non-breaking additions to existing versions

See [API Versioning](./API_VERSIONING.md) and [Changelog](./API_CHANGELOG.md) for details.

## Related Documentation

- **General Documentation**: See [../../../docs/](../../../docs/) for system-wide documentation
- **Worker Documentation**: See [../../worker/docs/](../../worker/docs/) for worker service documentation
- **Dashboard Documentation**: See [../../dashboard/docs/](../../dashboard/docs/) for frontend documentation
- **Database Documentation**: See [../../../packages/database/docs/](../../../packages/database/docs/) for database documentation

## Support

- **Interactive Docs**: [API Documentation](http://localhost:3001/api/v1/docs)
- **Repository**: [GitHub](https://github.com/ramiz4/helvetia-cloud)
- **Issues**: [GitHub Issues](https://github.com/ramiz4/helvetia-cloud/issues)
