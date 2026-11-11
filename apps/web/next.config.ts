import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@rentora/shared'],
  reactStrictMode: true
};

export default config;
