import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Самодостаточная сборка для Docker-образа
  output: 'standalone',
  // Корень monorepo — чтобы в standalone попал пакет @kirilovskiy/shared
  outputFileTracingRoot: path.join(__dirname, '../../'),
  turbopack: { root: path.join(__dirname, '../../') },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
