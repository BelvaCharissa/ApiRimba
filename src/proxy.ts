import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/** Halaman yang wajib masuk. Peran (petugas/admin) tetap diperiksa lagi di server dan basis data. */
const PROTECTED = ['/akun', '/petugas'];

/**
 * Menyegarkan sesi Supabase di cookie pada tiap permintaan halaman, lalu mengarahkan tamu
 * dari halaman terlindungi ke /masuk. Ini pemeriksaan awal saja; otorisasi sebenarnya ada di
 * route handler (getViewer) dan fungsi RPC basis data.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
      },
    },
  });

  const { data } = await sb.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const to = request.nextUrl.clone();
    to.pathname = '/masuk';
    to.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }
  if (signedIn && (path === '/masuk' || path === '/daftar')) {
    const to = request.nextUrl.clone();
    to.pathname = '/akun';
    to.search = '';
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  // Lewati aset statis, gambar, data, dan API (route API memeriksa sesi sendiri).
  matcher: ['/((?!api|_next/static|_next/image|brand|img|data|vendor|favicon.ico|icon.png|apple-icon.png|.*\\.(?:png|jpg|jpeg|webp|svg|json|mjs)$).*)'],
};
