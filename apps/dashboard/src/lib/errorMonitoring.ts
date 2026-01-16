import * as Sentry from '@sentry/nextjs';

/**
 * Initialize error monitoring with user context
 * @param user User information to attach to error reports
 */
export function setUserContext(user: { id: string; email?: string; username?: string }): void {
  if (!isSentryConfigured()) {
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext(): void {
  if (!isSentryConfigured()) {
    return;
  }

  Sentry.setUser(null);
}

/**
 * Set route/page context for error reports
 * @param route Current route/page path
 * @param params Optional route parameters
 */
export function setRouteContext(route: string, params?: Record<string, unknown>): void {
  if (!isSentryConfigured()) {
    return;
  }

  Sentry.setContext('route', {
    path: route,
    params,
  });
}

/**
 * Report an error to the monitoring service
 * @param error The error to report
 * @param context Additional context information
 */
export function reportError(
  error: Error,
  context?: {
    componentStack?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): void {
  if (!isSentryConfigured()) {
    // Graceful fallback - just log to console
    console.error('Error (Sentry not configured):', error, context);
    return;
  }

  Sentry.captureException(error, {
    contexts: context?.componentStack
      ? {
          react: {
            componentStack: context.componentStack,
          },
        }
      : undefined,
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Report a message to the monitoring service
 * @param message The message to report
 * @param level The severity level
 * @param context Additional context
 */
export function reportMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>,
): void {
  if (!isSentryConfigured()) {
    console[level === 'warning' ? 'warn' : level](message, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Check if Sentry is configured
 * @returns true if Sentry DSN is configured
 */
function isSentryConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SENTRY_DSN;
}
