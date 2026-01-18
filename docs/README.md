# Documentation Guide

This directory contains general documentation that applies to the entire Helvetia Cloud platform. Component-specific documentation has been organized into their respective project directories.

## General Documentation (This Directory)

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design decisions
- **[ROADMAP.md](./ROADMAP.md)** - Project roadmap and future plans
- **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)** - Deployment, CI/CD, and configuration
- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Login system and security
- **[BILLING.md](./BILLING.md)** - Subscription system, UI, and limits
- **[FEATURES.md](./FEATURES.md)** - Organizations, admin, and other core features
- **[TESTING.md](./TESTING.md)** - Testing strategy and coverage reports
- **[DOCKER_SECURITY_HARDENING.md](./DOCKER_SECURITY_HARDENING.md)** - Detailed security hardening guide

## Component-Specific Documentation

### API Documentation

Location: `apps/api/docs/`

API-specific documentation including versioning, error codes, security, logging, metrics, and implementation details.

**Key Files:**

- [API_VERSIONING.md](../apps/api/docs/API_VERSIONING.md) - API versioning strategy
- [ERROR_CODES.md](../apps/api/docs/ERROR_CODES.md) - Error code reference
- [SECURITY.md](../apps/api/docs/SECURITY.md) - Security guidelines and authentication
- [LOGGING.md](../apps/api/docs/LOGGING.md) - Logging patterns and best practices
- [METRICS.md](../apps/api/docs/METRICS.md) - Observability and monitoring metrics
- [REQUEST_TRACING.md](../apps/api/docs/REQUEST_TRACING.md) - Request ID tracing
- [SSE_AND_STATUS_MANAGEMENT.md](../apps/api/docs/SSE_AND_STATUS_MANAGEMENT.md) - Server-Sent Events and status management
- [DI_IMPLEMENTATION_SUMMARY.md](../apps/api/docs/DI_IMPLEMENTATION_SUMMARY.md) - Dependency injection framework
- [MIGRATION_GUIDE.md](../apps/api/docs/MIGRATION_GUIDE.md) - DI migration guide
- [BILLING_TESTS.md](../apps/api/docs/BILLING_TESTS.md) - Billing test infrastructure and documentation

[View all API documentation →](../apps/api/docs/)

### Worker Documentation

Location: `apps/worker/docs/`

Worker service documentation including health checks, monitoring, and integration tests.

**Key Files:**

- [HEALTH_CHECK.md](../apps/worker/docs/HEALTH_CHECK.md) - Health check endpoints and format
- [MONITORING_SETUP.md](../apps/worker/docs/MONITORING_SETUP.md) - Monitoring and observability setup
- [INTEGRATION_TESTS.md](../apps/worker/docs/INTEGRATION_TESTS.md) - Worker integration tests

[View all Worker documentation →](../apps/worker/docs/)

### Dashboard Documentation

Location: `apps/dashboard/docs/`

Frontend-specific documentation including accessibility and feature flags.

**Key Files:**

- [ACCESSIBILITY.md](../apps/dashboard/docs/ACCESSIBILITY.md) - WCAG compliance and accessibility testing
- [FEATURE_FLAGS.md](../apps/dashboard/docs/FEATURE_FLAGS.md) - Feature flag system and usage

[View all Dashboard documentation →](../apps/dashboard/docs/)

### Database Documentation

Location: `packages/database/docs/`

Database-specific documentation including migration guidelines.

**Key Files:**

- [DATABASE_MIGRATIONS.md](../packages/database/docs/DATABASE_MIGRATIONS.md) - Database migration guidelines

[View all Database documentation →](../packages/database/docs/)

## Quick Links

- **Getting Started**: See main [README.md](../README.md)
- **Contributing**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview
- **Security**: See [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) and [DOCKER_SECURITY_HARDENING.md](./DOCKER_SECURITY_HARDENING.md)
- **Testing**: See [TESTING.md](./TESTING.md)
