# API Documentation

This directory contains API-specific documentation for the Helvetia Cloud API service.

## Contents

### Core API Documentation

- **[API_VERSIONING.md](./API_VERSIONING.md)** - API versioning strategy and version negotiation
- **[ERROR_CODES.md](./ERROR_CODES.md)** - Comprehensive error code reference
- **[REQUEST_TRACING.md](./REQUEST_TRACING.md)** - Request ID tracing across services

### Configuration & Limits

- **[BODY_SIZE_LIMITS.md](./BODY_SIZE_LIMITS.md)** - Request body size limits and configuration
- **[SAFE_QUERY_PATTERNS.md](./SAFE_QUERY_PATTERNS.md)** - Safe Prisma query patterns

### Security & Authentication

- **[SECURITY.md](./SECURITY.md)** - Security guidelines, authentication, and token management

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

## Related Documentation

- **General Documentation**: See [../../docs/](../../docs/) for system-wide documentation
- **Worker Documentation**: See [../../worker/docs/](../../worker/docs/) for worker service documentation
- **Database Documentation**: See [../../packages/database/docs/](../../packages/database/docs/) for database documentation
