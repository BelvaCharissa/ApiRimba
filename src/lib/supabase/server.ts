import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

let client: SupabaseClient | null = null;

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/**
 * Klien Supabase anonim untuk data publik. Memakai publishable key: semua tabel dilindungi RLS
 * dan hanya bisa diakses lewat fungsi RPC yang diizinkan.
 */
export function getSupabase(): SupabaseClient | null {
  const e = env();
  if (!e) return null;
  client ??= createClient(e.url, e.key, { auth: { persistSession: false } });
  return client;
}

/**
 * Klien Supabase atas nama pengguna yang sedang masuk (sesi dari cookie). Dibuat baru per permintaan.
 * Bila belum masuk, berperilaku sama seperti klien anonim. RPC yang memakai auth.uid() bergantung pada klien ini.
 */
export async function getSessionSupabase(): Promise<SupabaseClient | null> {
  const e = env();
  if (!e) return null;
  const jar = await cookies();
  return createServerClient(e.url, e.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // dipanggil dari Server Component: cookie disegarkan oleh proxy.ts
        }
      },
    },
  });
}

export type Role = 'anon' | 'warga' | 'petugas' | 'admin' | 'demo' | 'demo_admin';
export const STAFF_ROLES: readonly Role[] = ['petugas', 'admin', 'demo', 'demo_admin'];
/** Peran yang boleh membuka halaman admin (demo_admin dibatasi di basis data). */
export const ADMIN_ROLES: readonly Role[] = ['admin', 'demo_admin'];
/** Akun demo publik: kontak warga selalu disembunyikan. */
export const DEMO_ROLES: readonly Role[] = ['demo', 'demo_admin'];

export interface Viewer {
  sb: SupabaseClient | null;
  user: User | null;
  role: Role;
}

/** Pengguna yang sedang masuk, diverifikasi ke server Auth (bukan sekadar membaca cookie). */
export async function getViewer(): Promise<Viewer> {
  const sb = await getSessionSupabase();
  if (!sb) return { sb: null, user: null, role: 'anon' };
  const { data } = await sb.auth.getUser();
  const user = data.user ?? null;
  if (!user) return { sb, user: null, role: 'anon' };
  const { data: role } = await sb.rpc('my_role');
  const r = typeof role === 'string' && ['warga', 'petugas', 'admin', 'demo', 'demo_admin'].includes(role) ? (role as Role) : 'warga';
  return { sb, user, role: r };
}
