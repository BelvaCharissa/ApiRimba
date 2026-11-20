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
  // Simulator dan peta pantau digabung menjadi satu halaman /peta (parameter ikut diteruskan).
  async redirects() {
    return [
      { source: '/simulator', destination: '/peta', permanent: false },
      { source: '/dashboard', destination: '/peta', permanent: false },
    ];
  },
};

export default nextConfig;
