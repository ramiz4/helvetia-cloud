/**
 * Helper function to parse and get allowed origins from environment
 */
export function getAllowedOrigins(): string[] {
  const originsEnv =
    process.env.ALLOWED_ORIGINS || process.env.APP_BASE_URL || 'http://localhost:3000';
  return originsEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Helper function to validate if an origin is allowed
 * Note: This returns false for undefined origins, but the CORS plugin
 * at the framework level allows no-origin requests (same-origin, curl, etc.)
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

/**
 * Helper function to get a safe origin for CORS headers
 * Returns the validated request origin if allowed, otherwise the first allowed origin
 */
export function getSafeOrigin(requestOrigin: string | undefined): string {
  const allowedOrigins = getAllowedOrigins();

  // Ensure we always have at least one allowed origin
  if (allowedOrigins.length === 0) {
    throw new Error('CORS misconfiguration: No allowed origins configured');
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0];
}
