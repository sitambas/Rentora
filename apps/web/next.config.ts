import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@rentora/shared'],
  reactStrictMode: true,
  // Production builds include a self-contained server (used by the Dockerfile).
  output: 'standalone',
  // Builds run from apps/web; trace from the repository root so the shared package is included.
  outputFileTracingRoot: resolve(process.cwd(), '../..')
};

export default config;
