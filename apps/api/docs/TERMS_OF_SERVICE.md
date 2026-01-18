# Terms of Service Implementation

This document describes the Terms of Service (ToS) implementation for Helvetia Cloud.

## Overview

The implementation includes:

- ✅ Comprehensive ToS content in 4 languages (EN, DE, FR, IT)
- ✅ Database models for versioning and tracking acceptance
- ✅ API endpoints for retrieving and accepting terms
- ✅ Dashboard UI for viewing and accepting terms
- ✅ Automatic modal for terms acceptance
- ✅ Multi-language support

## Architecture

### Database Schema

Two new models were added to track terms:

```prisma
model TermsVersion {
  id          String   @id @default(uuid())
  version     String   @unique
  content     String   @db.Text
  language    String   @default("en")
  effectiveAt DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  acceptances UserTermsAcceptance[]
}

model UserTermsAcceptance {
  id             String       @id @default(uuid())
  userId         String
  termsVersionId String
  ipAddress      String?
  userAgent      String?
  acceptedAt     DateTime     @default(now())

  user         User         @relation(...)
  termsVersion TermsVersion @relation(...)
}
```

### API Endpoints

All endpoints are under `/api/v1/terms`:

#### Public Endpoints

- **GET /terms/latest** - Get latest terms for a language
  - Query: `?language=en` (optional, default: en)
  - Returns: Full terms content with metadata

- **GET /terms/version** - Get specific terms version
  - Query: `?version=1.0.0&language=en`
  - Returns: Specific version content

- **GET /terms/versions** - List all versions
  - Query: `?language=en` (optional)
  - Returns: List of all versions (metadata only)

#### Authenticated Endpoints

- **POST /terms/accept** - Accept terms
  - Body: `{ termsVersionId: string }`
  - Returns: Acceptance record
  - Requires: JWT authentication

- **GET /terms/check-acceptance** - Check if user needs to accept terms
  - Query: `?language=en` (optional)
  - Returns: `{ requiresAcceptance: boolean, latestVersion: {...} }`
  - Requires: JWT authentication

### Dashboard Components

#### Pages

- **/terms** - Public terms page
  - Displays latest terms
  - Language selector
  - Responsive design
  - Server-rendered for SEO

#### Components

- **TermsAcceptanceModal** - Modal for accepting terms
  - Scroll-to-accept functionality
  - Displays terms content
  - Handles acceptance submission

- **TermsAcceptanceWrapper** - Automatic terms enforcement
  - Checks acceptance status for authenticated users
  - Shows modal when needed
  - Integrated into app layout

#### Hooks

- **useTermsAcceptance** - React Query hooks
  - `useLatestTerms(language)` - Fetch latest terms
  - `useAcceptanceStatus()` - Check user's status
  - `useAcceptTerms()` - Mutation for acceptance

## Content Management

### Terms Content Files

Terms are stored as Markdown files in `apps/api/src/data/terms/`:

```
v1.0.0-en.md  - English
v1.0.0-de.md  - German
v1.0.0-fr.md  - French
v1.0.0-it.md  - Italian
```

Each file contains the complete terms in markdown format with all 15 required sections:

1. Introduction & Acceptance
2. Definitions
3. Account Registration
4. Service Description
5. Acceptable Use Policy
6. Content & Intellectual Property
7. Payment & Billing
8. Service Limits & Quotas
9. Data & Privacy
10. Security
11. Service Level Agreement (SLA)
12. Liability & Warranties
13. Termination
14. Dispute Resolution
15. Miscellaneous

### Adding New Terms Versions

1. Create new markdown files:

   ```bash
   apps/api/src/data/terms/v1.1.0-en.md
   apps/api/src/data/terms/v1.1.0-de.md
   apps/api/src/data/terms/v1.1.0-fr.md
   apps/api/src/data/terms/v1.1.0-it.md
   ```

2. Run initialization script:

   ```bash
   cd apps/api
   pnpm tsx src/scripts/init-terms.ts
   ```

   Or programmatically:

   ```typescript
   await termsService.initializeTermsFromFiles('1.1.0', new Date('2026-02-01'));
   ```

3. Users will automatically be prompted to accept new terms

## Deployment

### Initial Setup

1. Run database migration:

   ```bash
   cd packages/database
   pnpm migrate:deploy
   ```

2. Initialize terms in database:
   ```bash
   cd apps/api
   pnpm tsx src/scripts/init-terms.ts
   ```

### Environment Variables

No additional environment variables required. Uses existing:

- `DATABASE_URL` - For database connection
- `NEXT_PUBLIC_API_URL` - For API calls from dashboard

## User Flow

### First-Time Users

1. User signs up / logs in
2. `TermsAcceptanceWrapper` checks acceptance status via API
3. If not accepted, shows `TermsAcceptanceModal`
4. User must scroll to bottom and click "Accept"
5. Acceptance recorded with IP and user agent
6. User can proceed to use the platform

### Existing Users (New Terms Version)

1. New terms version is added to database
2. User logs in
3. System detects user hasn't accepted latest version
4. `TermsAcceptanceModal` automatically appears
5. User must accept to continue using platform

### Viewing Terms

1. User clicks "Terms of Service" in footer
2. Taken to `/terms` page
3. Can select language
4. Can view current and historical versions

## Legal Compliance

### Swiss Law

- Terms governed by Swiss law
- Jurisdiction: Zurich, Switzerland
- Compliant with Swiss data protection standards

### GDPR/DSGVO

- Clear consent mechanism
- Data portability
- Right to erasure
- Privacy by design

### Acceptance Tracking

For legal purposes, we track:

- User ID
- Terms version ID
- IP address (optional)
- User agent (optional)
- Acceptance timestamp

## Testing

### API Tests

```bash
cd apps/api
pnpm test src/controllers/TermsController.test.ts
pnpm test src/services/TermsService.test.ts
pnpm test src/repositories/PrismaTermsRepository.test.ts
```

### Dashboard Tests

```bash
cd apps/dashboard
pnpm test src/hooks/useTermsAcceptance.test.tsx
pnpm test src/components/TermsAcceptanceModal.test.tsx
```

### Integration Tests

```bash
# Test full acceptance flow
pnpm test:e2e terms-acceptance.spec.ts
```

## Translations

UI translations are in `packages/shared-ui/src/locales/`:

- `en.json` - English
- `de.json` - German
- `fr.json` - French
- `it.json` - Italian
- `gsw.json` - Swiss German

All ToS-related UI strings are under the `terms` namespace.

## Maintenance

### Updating Translations

Edit files in `packages/shared-ui/src/locales/`:

```typescript
{
  "terms": {
    "pageTitle": "Terms of Service",
    "acceptAndContinue": "Accept and Continue",
    // ... other keys
  }
}
```

### Monitoring Acceptance

Query acceptance rates:

```sql
-- Acceptance rate by version
SELECT
  tv.version,
  tv.language,
  COUNT(DISTINCT uta.userId) as accepted_users,
  COUNT(DISTINCT u.id) as total_users
FROM "TermsVersion" tv
LEFT JOIN "UserTermsAcceptance" uta ON tv.id = uta."termsVersionId"
CROSS JOIN "User" u
WHERE tv.language = 'en'
GROUP BY tv.version, tv.language;

-- Users who haven't accepted latest terms
SELECT u.id, u.username, u.email
FROM "User" u
WHERE u.id NOT IN (
  SELECT uta."userId"
  FROM "UserTermsAcceptance" uta
  JOIN "TermsVersion" tv ON uta."termsVersionId" = tv.id
  WHERE tv.version = '1.0.0' AND tv.language = 'en'
);
```

## Troubleshooting

### Terms Not Loading

1. Check API is running: `curl http://localhost:3001/api/v1/terms/latest`
2. Verify database has terms: `SELECT * FROM "TermsVersion"`
3. Run initialization if missing: `pnpm tsx src/scripts/init-terms.ts`

### Modal Not Showing

1. Check user is authenticated
2. Verify `TermsAcceptanceWrapper` is in layout
3. Check API endpoint: `/api/v1/terms/check-acceptance`
4. Review browser console for errors

### Acceptance Not Saving

1. Verify user is authenticated (JWT valid)
2. Check API logs for errors
3. Ensure database connection is working
4. Verify terms version ID is correct

## Future Enhancements

Potential improvements:

- [ ] Admin panel for managing terms
- [ ] Email notifications for terms updates
- [ ] Diff view between versions
- [ ] Download terms as PDF
- [ ] Terms acceptance reminders
- [ ] Analytics dashboard for acceptance rates
- [ ] A/B testing for terms presentation

## Support

For questions or issues:

- Email: legal@helvetia.cloud
- Support: support@helvetia.cloud
- Documentation: `/docs`

---

**Last Updated:** January 18, 2026
**Version:** 1.0.0
