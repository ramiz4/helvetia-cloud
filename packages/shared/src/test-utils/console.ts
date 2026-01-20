import { vi } from 'vitest';

/**
 * Suppress console output in tests
 * This is useful to keep test output clean and focused on test results
 *
 * @example
 * ```typescript
 * import { suppressConsoleOutput } from 'shared/test-utils';
 *
 * // In your test setup file (e.g., src/test/setup.ts)
 * suppressConsoleOutput();
 * ```
 */
export function suppressConsoleOutput(): void {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
}

/**
 * Restore console output after tests
 * Use this if you need to temporarily restore console output
 *
 * @example
 * ```typescript
 * import { restoreConsoleOutput } from 'shared/test-utils';
 *
 * afterAll(() => {
 *   restoreConsoleOutput();
 * });
 * ```
 */
export function restoreConsoleOutput(): void {
  vi.restoreAllMocks();
}
