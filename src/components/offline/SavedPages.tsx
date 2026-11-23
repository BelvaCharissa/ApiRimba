'use client';

import { useEffect, useState } from 'react';

const NAMES: Record<string, string> = {
  '/': 'Beranda / Home',
  '/peta': 'Peta & simulasi / Map & simulation',
  '/lapor': 'Lapor api / Report a fire',
  '/bantu': 'Beri bantuan / Give help',
  '/cara-kerja': 'Cara kerja / How it works',
  '/akun': 'Akun / Account',
  '/petugas': 'Meja petugas / Officer desk',
};

/** Daftar halaman yang tersimpan di cache service worker (bisa dibuka tanpa sinyal). */
export default function SavedPages() {
  const [paths, setPaths] = useState<string[] | null>(null);
  useEffect(() => {
    if (typeof caches === 'undefined') return;
    caches
      .open('apirimba-pages')
      .then((c) => c.keys())
      .then((keys) => setPaths([...new Set(keys.map((k) => new URL(k.url).pathname))].filter((p) => p !== '/offline').sort()))
      .catch(() => setPaths([]));
  }, []);
  if (!paths?.length) return null;
  return (
    <div className="glass mt-6 rounded-[18px] p-4 text-left">
      <p className="text-sm font-semibold text-ink">Tersimpan di perangkat ini / Saved on this device</p>
      <ul className="mt-2 space-y-1">
        {paths.map((p) => (
          <li key={p}>
            {/* Tautan biasa (bukan navigasi klien) agar service worker yang melayani halaman. */}
            <a href={p} className="text-sm font-semibold text-wind underline-offset-4 hover:underline">
              {NAMES[p] ?? p}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
