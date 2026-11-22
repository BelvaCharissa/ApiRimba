import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-next';
import { getSessionSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/**
 * Tujuan tautan dari email Supabase (konfirmasi akun, atur ulang sandi). Menukar kode/token
 * menjadi sesi di cookie, lalu mengarahkan ke jalur internal ?next=.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const sb = await getSessionSupabase();

  let ok = false;
  if (sb && code) {
    ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  } else if (sb && tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await sb.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  const to = url.clone();
  to.search = '';
  if (ok) {
    to.pathname = next;
  } else {
    to.pathname = '/masuk';
    to.searchParams.set('error', 'link');
  }
  return NextResponse.redirect(to);
}
