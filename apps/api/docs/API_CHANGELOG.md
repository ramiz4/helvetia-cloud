# API Changelog

All notable changes to the Helvetia Cloud API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.0.0] - 2024-01-16

### Added

#### Documentation

- **Comprehensive OpenAPI 3.0 Specification**: Full API documentation with interactive Swagger UI
- **API Getting Started Guide**: Quick start guide with code examples in JavaScript and Python
- **API Changelog**: Track all API changes and version updates
- **Webhook Documentation**: Complete guide for GitHub webhook integration

#### Authentication

- `POST /api/v1/auth/github` - GitHub OAuth authentication
- `POST /api/v1/auth/login` - Email/password authentication
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Revoke refresh tokens
- `GET /api/v1/auth/me` - Get current user information
- `DELETE /api/v1/auth/github/disconnect` - Disconnect GitHub account
- JWT-based authentication with access tokens (15min) and refresh tokens (7 days)
- Cookie-based and Bearer token authentication support

#### Services

- `GET /api/v1/services` - List all services
- `POST /api/v1/services` - Create a new service
- `GET /api/v1/services/:id` - Get service details
- `PATCH /api/v1/services/:id` - Update service configuration
- `DELETE /api/v1/services/:id` - Soft delete a service
- `POST /api/v1/services/:id/recover` - Recover deleted service
- `PATCH /api/v1/services/:id/protection` - Toggle delete protection
- `GET /api/v1/services/:id/health` - Get service health status
- `GET /api/v1/services/:id/metrics` - Get service metrics (CPU, memory)
- `GET /api/v1/services/metrics/stream` - Real-time metrics streaming (SSE)

#### Deployments

- `POST /api/v1/services/:id/deploy` - Trigger deployment
- `POST /api/v1/services/:id/restart` - Restart service container
- `POST /api/v1/services/:id/stop` - Stop service container
- `GET /api/v1/services/:id/deployments` - List service deployments
- `GET /api/v1/deployments/:id/logs` - Get deployment logs
- `GET /api/v1/deployments/:id/logs/stream` - Stream deployment logs (SSE)

#### Projects

- `GET /api/v1/projects` - List all projects
- `POST /api/v1/projects` - Create a new project
- `GET /api/v1/projects/:id` - Get project details
- `DELETE /api/v1/projects/:id` - Delete a project
- `POST /api/v1/projects/:id/environments` - Create project environment

#### Organizations

- `GET /api/v1/organizations` - List user organizations
- `POST /api/v1/organizations` - Create an organization
- `GET /api/v1/organizations/:id` - Get organization details with members
- `POST /api/v1/organizations/:id/members` - Add organization member
- `PATCH /api/v1/organizations/:id/members/:userId` - Update member role
- `DELETE /api/v1/organizations/:id/members/:userId` - Remove member
- Support for organization roles: OWNER, ADMIN, MEMBER

#### GitHub Integration

- `GET /api/v1/github/orgs` - Get user's GitHub organizations
- `GET /api/v1/github/repos` - Get repositories (user or organization)
- `GET /api/v1/github/repos/:owner/:name/branches` - Get repository branches
- `GET /api/v1/github/packages` - Get GitHub container packages
- GitHub API proxy with automatic token handling

#### Webhooks

- `POST /api/v1/webhooks/github` - GitHub webhook handler
- Support for push and pull_request events
- Automatic deployment triggering on push events
- Preview deployments for pull requests
- HMAC SHA-256 signature verification

#### Feature Flags

- `GET /api/v1/feature-flags` - List all feature flags (admin)
- `POST /api/v1/feature-flags` - Create feature flag (admin)
- `GET /api/v1/feature-flags/:id` - Get feature flag (admin)
- `PATCH /api/v1/feature-flags/:id` - Update feature flag (admin)
- `POST /api/v1/feature-flags/:id/toggle` - Toggle feature flag (admin)
- `DELETE /api/v1/feature-flags/:id` - Delete feature flag (admin)
- `POST /api/v1/feature-flags/check` - Check if feature is enabled (public)
- `POST /api/v1/feature-flags/check-bulk` - Check multiple features (public)

#### Monitoring

- `GET /health` - Health check endpoint
- `GET /metrics` - Prometheus metrics (text format)
- `GET /metrics/json` - Prometheus metrics (JSON format)
- Request tracing with X-Request-Id header
- Structured logging with request correlation

#### Rate Limiting

- Global rate limit: 100 requests/minute per IP
- Authentication endpoints: 5 requests/minute per IP
- Deployment endpoints: 10 requests/minute per user
- WebSocket/SSE endpoints: 20 connections/minute per user
- Feature flag checks: 30 requests/minute per IP
- Rate limit headers in responses (X-RateLimit-\*)

#### API Versioning

- URL-based versioning: `/api/v1/`
- Version negotiation strategy
- Backward compatibility policy
- 6-month support window for old versions

### Security

- JWT token-based authentication
- HTTP-only cookies for token storage
- CORS configuration with allowed origins
- Request body size limits (100KB for auth, 1MB for webhooks)
- GitHub webhook signature verification
- Password hashing with bcrypt
- Secure token refresh mechanism

### Performance

- Request ID tracking for distributed tracing
- Structured logging with Pino
- Prometheus metrics collection
- Redis-based rate limiting
- Connection pooling for database
- Efficient caching strategies

## Versioning Strategy

### Version Support Policy

- **Current Version (v1)**: Full support with new features and bug fixes
- **Previous Versions**: Security and critical bug fixes for 6 months
- **Deprecated Versions**: 3-month grace period before removal

### Breaking Changes Policy

Breaking changes require a new major version (v2, v3, etc.):

- Changes to request/response structure
- Removal of endpoints or fields
- Changes to authentication mechanism
- Changes to error response format

### Non-Breaking Changes

Can be added to existing versions:

- New endpoints
- New optional fields in requests
- New fields in responses
- New query parameters
- Performance improvements
- Bug fixes

## Deprecation Process

1. **Announcement** (Version N): Mark feature as deprecated in documentation
2. **Warning Period** (6 months): Feature continues to work, warnings in responses
3. **New Version** (Version N+1): Feature removed, alternative provided
4. **Support End** (6 months after N+1): Version N no longer supported

## Migration Guides

When breaking changes are introduced, detailed migration guides will be provided in:

- API documentation
- GitHub releases
- Email notifications to API users

## Upcoming Changes

### Planned for v1.1 (Non-Breaking)

- [ ] Database management endpoints (PostgreSQL, MySQL, Redis)
- [ ] Custom domain management
- [ ] Service logs endpoint with filtering
- [ ] Service environment variables bulk update
- [ ] Deployment rollback functionality
- [ ] Organization billing and usage endpoints
- [ ] Audit log endpoints
- [ ] Two-factor authentication (2FA)

### Planned for v2.0 (Breaking)

- [ ] GraphQL API alongside REST
- [ ] WebSocket for real-time updates (replacing SSE)
- [ ] Enhanced webhook payload structure
- [ ] Revised error response format
- [ ] OAuth 2.0 client credentials flow
- [ ] Regional API endpoints

## Support

For questions about API changes or migration assistance:

- **Documentation**: [API Reference](https://api.helvetia.cloud/api/v1/docs)
- **Repository**: [GitHub](https://github.com/ramiz4/helvetia-cloud)
- **Issues**: [GitHub Issues](https://github.com/ramiz4/helvetia-cloud/issues)

## Subscribe to Updates

Stay informed about API changes:

1. Watch the [GitHub repository](https://github.com/ramiz4/helvetia-cloud)
2. Subscribe to release notifications
3. Follow breaking change announcements
4. Check this changelog regularly

---

**Note**: This changelog follows [semantic versioning](https://semver.org/). Version numbers use the format MAJOR.MINOR.PATCH where:

- **MAJOR**: Breaking changes requiring client updates
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible
