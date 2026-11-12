import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Aplikasi ini sebagian besar interaktif di klien (peta + Web Worker), jadi memakai
  // model caching klasik tanpa Cache Components agar lebih sederhana.
  cacheComponents: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
