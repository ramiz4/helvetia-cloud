# Shared UI Package

Shared UI components and frontend utilities for Helvetia Cloud Dashboard and Admin applications.

## Contents

This package contains frontend-only code that can be safely used in Next.js applications:

### UI Components

- `ConfirmationModal` - Reusable confirmation dialog component

### Configuration & Environment

- `config.ts` - Environment variables and configuration
- `env.ts` - Environment validation with Zod

### Authentication

- `tokenRefresh.ts` - JWT token refresh utilities

### Internationalization (i18n)

- `LanguageContext` - React context for language management
- `translations.ts` - Translation strings
- `locales/` - JSON translation files (en, de, fr, it, gsw)

### Type Definitions

- `organization.ts` - Organization and role types

## Usage

```typescript
// Import from the package
import { ConfirmationModal, useLanguage, API_BASE_URL, fetchWithAuth, Role } from 'shared-ui';
```

## Building

```bash
pnpm build
```

## Testing

```bash
pnpm test
```

## Why a Separate Package?

This package was created to separate frontend utilities from backend utilities in `packages/shared`. The original `shared` package contains Node.js-specific dependencies (Docker, Redis) that cannot be imported in browser/Next.js code. By separating frontend utilities into `shared-ui`, we:

1. Avoid pulling Node.js dependencies into browser bundles
2. Enable code sharing between Dashboard and Admin apps
3. Maintain clear separation of concerns
4. Improve build performance and bundle sizes
