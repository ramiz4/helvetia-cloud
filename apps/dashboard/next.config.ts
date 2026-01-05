import type { NextConfig } from 'next';

import path from 'path';

const nextConfig: NextConfig = {
  env: {
    // We don't need to manually load env vars here as Next.js doesn't support
    // loading from parent directories automatically in next.config.ts for runtime usage.
    // However, since we are in a monorepo, we rely on the root .env being present
    // or loaded via a script if needed. But for Next.js, usually you either symlink it
    // or just rely on process.env being populated by the runner (like turbo/pnpm).
    // Given the user wants to enforce root .env usage, we can try to use dotenv-cli or similar
    // to run the dev script.
    // For now, let's just leave this valid config.
  },
  turbopack: {
    root: path.resolve(__dirname, '../../'),
  },
  allowedDevOrigins: ['192.168.1.11', '192.168.1.11:3000', 'localhost', 'localhost:3000'],
};

export default nextConfig;
