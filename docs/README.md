# Documentation Guide

This directory contains general documentation that applies to the entire Helvetia Cloud platform. Component-specific documentation has been organized into their respective project directories.

## General Documentation (This Directory)

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design decisions
- **[ROADMAP.md](./ROADMAP.md)** - Project roadmap and future plans
- **[INTEGRATION_TESTS.md](./INTEGRATION_TESTS.md)** - Integration testing guide
- **[TEST_COVERAGE_REPORT.md](./TEST_COVERAGE_REPORT.md)** - Test coverage reports
- **[DOCKER_SECURITY_HARDENING.md](./DOCKER_SECURITY_HARDENING.md)** - Docker security hardening guide

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
- **Security**: See [DOCKER_SECURITY_HARDENING.md](./DOCKER_SECURITY_HARDENING.md) and [apps/api/docs/SECURITY.md](../apps/api/docs/SECURITY.md)
- **Testing**: See [INTEGRATION_TESTS.md](./INTEGRATION_TESTS.md) and [TEST_COVERAGE_REPORT.md](./TEST_COVERAGE_REPORT.md)
