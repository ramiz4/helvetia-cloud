import type { NextConfig } from 'next';

import { withSentryConfig } from '@sentry/nextjs';
import { config } from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '../../.env');
config({ path: envPath });

const nextConfig: NextConfig = {
  env: {
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    NEXT_PUBLIC_GITHUB_CLIENT_ID:
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname, '../../'),
  },
  output: 'standalone',
  allowedDevOrigins: ['192.168.1.11', '192.168.1.11:3000', 'localhost', 'localhost:3000'],
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build in non-CI environments.
  // In CI (process.env.CI === 'true'), logs are enabled to aid debugging.
  silent: process.env.CI !== 'true',
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

// Export config with Sentry if configured, otherwise export plain config
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
