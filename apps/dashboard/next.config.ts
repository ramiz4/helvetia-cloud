import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: '../../',
  },
  allowedDevOrigins: ['192.168.1.11', '192.168.1.11:3000', 'localhost', 'localhost:3000'],
};

export default nextConfig;
