'use client';

import { useEffect, useState } from 'react';

export type ViewerRole = 'anon' | 'warga' | 'petugas' | 'admin' | 'demo' | 'demo_admin';
export interface ClientViewer {
  user: { email: string | null; name: string | null } | null;
  role: ViewerRole;
}

const EVENT = 'apirimba:auth';
let cache: Promise<ClientViewer> | null = null;

function fetchViewer(): Promise<ClientViewer> {
  cache ??= fetch('/api/auth/me', { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<ClientViewer>) : { user: null, role: 'anon' as const }))
    .catch(() => ({ user: null, role: 'anon' as const }));
  return cache;
}

/** Panggil setelah masuk/keluar agar header dan komponen lain memuat ulang status akun. */
export function notifyAuthChanged() {
  cache = null;
  window.dispatchEvent(new Event(EVENT));
}

/** Status akun di klien (untuk tampilan saja; otorisasi tetap di server). null = sedang memuat. */
export function useViewer(): ClientViewer | null {
  const [v, setV] = useState<ClientViewer | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void fetchViewer().then((x) => alive && setV(x));
    load();
    window.addEventListener(EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, load);
    };
  }, []);
  return v;
}

export async function signOut() {
  await fetch('/api/auth/signout', { method: 'POST' });
  notifyAuthChanged();
}
