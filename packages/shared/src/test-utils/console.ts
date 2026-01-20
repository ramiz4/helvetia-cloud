import { vi } from 'vitest';

/**
 * Test utilities for suppressing console output in tests.
 *
 * @packageDocumentation
 * @requires vitest - This module requires vitest to be installed in the consuming package.
 *                    It is declared as an optional peer dependency, so ensure your test
 *                    environment includes vitest before importing these utilities.
 */

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
