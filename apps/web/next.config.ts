import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@parta5/db', '@parta5/storage', '@parta5/video'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
