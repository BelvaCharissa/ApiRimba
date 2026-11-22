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
  // Header keamanan untuk semua respons. CSP sengaja tidak membatasi script/gambar (peta memuat
  // ubin dari banyak sumber dan memakai Web Worker blob:), tetapi melarang halaman dibingkai situs
  // lain (clickjacking), plugin, dan pengalihan form ke domain luar.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
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
