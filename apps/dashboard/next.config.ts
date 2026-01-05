import type { NextConfig } from 'next';

import path from 'path';

const envPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: envPath });

const nextConfig: NextConfig = {
  env: {
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  },
  turbopack: {
    root: path.resolve(__dirname, '../../'),
  },
  allowedDevOrigins: ['192.168.1.11', '192.168.1.11:3000', 'localhost', 'localhost:3000'],
};

export default nextConfig;
