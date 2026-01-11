import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      database: path.resolve(__dirname, '../../packages/database/src/index.ts'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.config.ts', '**/test/**'],
      // Current coverage: ~42% statements, ~46% branches
      // Worker.ts (main deployment logic) requires Docker for proper testing
      // Target: Progressive improvement toward 80%
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 40,
        statements: 40,
      },
    },
  },
});
