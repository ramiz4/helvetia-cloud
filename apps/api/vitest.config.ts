import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.config.ts', '**/test/**'],
      // Current coverage: ~53% statements, ~53% branches
      // Target: Progressive improvement toward 80%
      thresholds: {
        lines: 50,
        functions: 45,
        branches: 50,
        statements: 50,
      },
    },
  },
});
