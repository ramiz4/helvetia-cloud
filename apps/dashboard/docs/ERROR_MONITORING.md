# Error Monitoring Setup

This document explains how error monitoring is configured in the Helvetia Cloud dashboard application using Sentry.

## Overview

The dashboard integrates with [Sentry](https://sentry.io) to provide comprehensive error tracking and monitoring for production deployments. This enables:

- **Automatic error capture**: React errors, unhandled promises, and console errors
- **User context**: Correlate errors with specific users
- **Route context**: Track which pages/routes experience issues
- **Stack traces**: Detailed stack traces with source maps for debugging
- **Performance monitoring**: Track application performance metrics
- **Session replay**: Replay user sessions leading to errors

## Configuration

### 1. Create a Sentry Account

1. Sign up at [https://sentry.io](https://sentry.io)
2. Create a new project for the dashboard (select "Next.js" as the platform)
3. Copy your DSN (Data Source Name) from the project settings

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Required for error monitoring
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Optional - only needed for source map uploads in production
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=your-project-name
SENTRY_AUTH_TOKEN=your-auth-token
```

**Notes:**

- `NEXT_PUBLIC_SENTRY_DSN` is the only required variable. Without it, error monitoring is disabled.
- The `NEXT_PUBLIC_` prefix makes this available in the browser (it's safe - this is a public token).
- Source map upload variables are only needed for production deployments to get readable stack traces.

### 3. Source Map Upload (Production)

For production deployments, enable source map uploads to get readable stack traces:

1. Create a Sentry auth token at: https://sentry.io/settings/account/api/auth-tokens/
2. Grant it `project:releases` and `org:read` permissions
3. Set the `SENTRY_AUTH_TOKEN` environment variable
4. During build, source maps will be automatically uploaded to Sentry

**Build Command with Source Maps:**

```bash
pnpm build
```

The `next.config.ts` automatically handles source map generation and upload when Sentry is configured.

## Features

### ErrorBoundary Integration

The `ErrorBoundary` component automatically reports all React errors to Sentry:

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

**What's captured:**

- Error message and stack trace
- React component stack
- User information (if set)
- Current route/page
- Timestamp
- Browser and device information

### Manual Error Reporting

You can manually report errors using the error monitoring utility:

```typescript
import { reportError, reportMessage } from '@/lib/errorMonitoring';

try {
  await riskyOperation();
} catch (error) {
  reportError(error as Error, {
    tags: { operation: 'riskyOperation' },
    extra: { userId: currentUser.id },
  });
}

// Report non-error events
reportMessage('User completed checkout', 'info', {
  orderId: '123',
  amount: 99.99,
});
```

### User Context

Set user context to correlate errors with specific users:

```typescript
import { setUserContext, clearUserContext } from '@/lib/errorMonitoring';

// After login
setUserContext({
  id: user.id,
  email: user.email,
  username: user.username,
});

// On logout
clearUserContext();
```

### Route Context

Set route context to track which pages have errors:

```typescript
import { setRouteContext } from '@/lib/errorMonitoring';

useEffect(() => {
  setRouteContext(router.pathname, { projectId: params.id });
}, [router.pathname]);
```

## Development vs Production

### Development

- Errors are logged to the console
- Sentry is disabled by default (unless `NEXT_PUBLIC_SENTRY_DSN` is set)
- No network requests to Sentry

### Production

- Errors are sent to Sentry
- Source maps are uploaded for readable stack traces
- Session replay captures user interactions
- Performance monitoring is enabled

## Privacy Considerations

The Sentry configuration includes privacy-first defaults:

- **Session Replay**: Masks all text and blocks media by default
- **Sampling**: Only 10% of sessions are recorded, 100% of error sessions
- **User Data**: Only captures ID, email, and username (no sensitive data)
- **PII Scrubbing**: Sentry automatically scrubs sensitive data (credit cards, SSNs, etc.)

You can adjust these settings in the Sentry configuration files:

- `sentry.client.config.ts` - Browser configuration
- `sentry.server.config.ts` - Server-side configuration
- `sentry.edge.config.ts` - Edge runtime configuration

## Testing Error Monitoring

To test that error monitoring is working:

1. Set `NEXT_PUBLIC_SENTRY_DSN` in your `.env` file
2. Trigger an error in the application
3. Check your Sentry dashboard for the error

**Example test component:**

```typescript
function ErrorTestButton() {
  const throwError = () => {
    throw new Error('Test error for Sentry');
  };

  return <button onClick={throwError}>Trigger Error</button>;
}
```

## Disabling Error Monitoring

To disable error monitoring:

1. Remove or comment out `NEXT_PUBLIC_SENTRY_DSN` in `.env`
2. Rebuild the application

The error monitoring utility includes graceful fallbacks, so the application will continue to work without Sentry configured (errors will just be logged to console).

## Performance Impact

Sentry's performance impact is minimal:

- **Bundle size**: ~50KB gzipped (async loaded)
- **Runtime overhead**: <1% CPU usage
- **Network**: Errors batched and sent asynchronously
- **Session replay**: Only captured when configured (optional)

## Troubleshooting

### Errors not appearing in Sentry

1. Check that `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Verify the DSN is active in your Sentry project settings
3. Check browser console for Sentry initialization errors
4. Ensure you've rebuilt the application after setting environment variables

### Source maps not working

1. Verify `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are set
2. Check that the auth token has correct permissions
3. Look for upload errors in the build logs
4. Ensure source maps are generated (`productionBrowserSourceMaps: true` in config)

### Rate limiting

Sentry has quotas based on your plan. If you're hitting limits:

1. Adjust `tracesSampleRate` in the Sentry config files
2. Filter out noisy errors in the `beforeSend` hook
3. Consider upgrading your Sentry plan

## Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io)
- [Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Privacy & Security](https://docs.sentry.io/security-legal-pii/)
