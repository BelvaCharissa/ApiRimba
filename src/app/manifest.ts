import type { MetadataRoute } from 'next';

/** Manifest PWA: ApiRimba bisa dipasang ke layar utama ponsel dan dibuka saat offline. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ApiRimba: prediksi api gambut',
    short_name: 'ApiRimba',
    description: 'Prediksi sebaran api gambut 12 jam, asap, sekat bakar, dan lapor api oleh warga. Tetap terbuka saat sinyal hilang.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0b1d15',
    theme_color: '#0b1d15',
    lang: 'id',
    categories: ['utilities', 'weather', 'navigation'],
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/logo-mark.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcuts: [
      { name: 'Lapor api', short_name: 'Lapor', url: '/lapor' },
      { name: 'Peta titik panas', short_name: 'Peta', url: '/peta' },
    ],
  };
}
