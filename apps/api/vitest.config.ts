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
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/helvetia_test',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6380',
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || 'test-client-id',
      GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || 'test-client-secret',
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-change-me-in-production',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef',
      // Stripe test keys for billing tests
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_mock',
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock',
      STRIPE_PRICE_ID_STARTER: process.env.STRIPE_PRICE_ID_STARTER || 'price_test_starter',
      STRIPE_PRICE_ID_PRO: process.env.STRIPE_PRICE_ID_PRO || 'price_test_pro',
      STRIPE_PRICE_ID_ENTERPRISE: process.env.STRIPE_PRICE_ID_ENTERPRISE || 'price_test_enterprise',
    },
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
