import type { NextConfig } from 'next';

import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '../../'),
  },
  allowedDevOrigins: ['192.168.1.11', '192.168.1.11:3000', 'localhost', 'localhost:3000'],
};

export default nextConfig;
