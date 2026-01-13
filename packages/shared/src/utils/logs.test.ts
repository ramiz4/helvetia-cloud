import { describe, expect, it } from 'vitest';
import { createScrubber } from './logs';

describe('Log Scrubber', () => {
  it('should redact secrets from logs', () => {
    const secrets = ['secret123', 'mypassword'];
    const scrubber = createScrubber(secrets);

    const log = 'Starting app with secret123 and mypassword...';
    const result = scrubber(log);

    expect(result).toBe('Starting app with [REDACTED] and [REDACTED]...');
  });

  it('should ignore secrets shorter than 3 characters', () => {
    const secrets = ['ab', 'secret123'];
    const scrubber = createScrubber(secrets);

    const log = 'User ab with secret123';
    const result = scrubber(log);

    expect(result).toBe('User ab with [REDACTED]');
  });

  it('should handle empty secrets', () => {
    const scrubber = createScrubber([]);
    const log = 'No secrets here';
    expect(scrubber(log)).toBe(log);
  });
});
