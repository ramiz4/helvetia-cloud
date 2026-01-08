import type { NextConfig } from 'next';

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
  allowedDevOrigins: ['192.168.1.11', '192.168.1.11:3000', 'localhost', 'localhost:3000'],
};

export default nextConfig;
