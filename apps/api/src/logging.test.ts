import { describe, expect, it } from 'vitest';
import { LOG_LEVEL, LOG_REDACT_PATHS, LOG_REQUESTS, LOG_RESPONSES } from './config/constants.js';

/**
 * Tests for logging configuration constants
 *
 * These tests verify that the logging system is properly configured
 * with appropriate defaults and sensitive data redaction.
 */
describe('Logging Configuration', () => {
  it('should export logging constants', () => {
    expect(LOG_LEVEL).toBeDefined();
    expect(LOG_REDACT_PATHS).toBeInstanceOf(Array);
    expect(typeof LOG_REQUESTS).toBe('boolean');
    expect(typeof LOG_RESPONSES).toBe('boolean');
  });

  it('should use info as default log level when not set', () => {
    // LOG_LEVEL should default to 'info' if environment variable is not set
    expect(LOG_LEVEL).toBe(process.env.LOG_LEVEL || 'info');
  });

  it('should disable request logging by default', () => {
    // LOG_REQUESTS should be false by default
    expect(LOG_REQUESTS).toBe(process.env.LOG_REQUESTS === 'true');
  });

  it('should disable response logging by default', () => {
    // LOG_RESPONSES should be false by default
    expect(LOG_RESPONSES).toBe(process.env.LOG_RESPONSES === 'true');
  });

  it('should redact sensitive paths', () => {
    // Check that sensitive fields are redacted
    expect(LOG_REDACT_PATHS).toContain('req.headers.authorization');
    expect(LOG_REDACT_PATHS).toContain('req.headers.cookie');
    expect(LOG_REDACT_PATHS).toContain('req.body.password');
    expect(LOG_REDACT_PATHS).toContain('req.body.token');
    expect(LOG_REDACT_PATHS).toContain('req.body.secret');
    expect(LOG_REDACT_PATHS).toContain('req.body.githubAccessToken');
  });

  it('should have at least 6 redacted paths', () => {
    // Ensure we're redacting enough sensitive information
    expect(LOG_REDACT_PATHS.length).toBeGreaterThanOrEqual(6);
  });
});
