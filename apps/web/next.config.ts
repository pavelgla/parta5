import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@parta5/db', '@parta5/quiz', '@parta5/storage', '@parta5/video'],
  experimental: {
    typedRoutes: true,
  },
  // Workspace packages are consumed as TypeScript source and are ESM
  // ("type": "module"), so their relative imports carry the .js extensions that
  // NodeNext requires — the worker typechecks the same source. Bundlers do not
  // apply that mapping themselves: without extensionAlias every "./foo.js"
  // import inside @parta5/* fails to resolve and the app does not build.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
