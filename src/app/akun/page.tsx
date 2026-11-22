import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AccountView, { type AccountData } from '@/components/auth/AccountView';
import { getLang } from '@/lib/i18n-server';
import { getViewer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const id = (await getLang()) === 'id';
  return { title: id ? 'Akun' : 'Account', robots: { index: false, follow: false } };
}

/** Halaman akun: profil, laporan, janji bantuan, dan simulasi milik pengguna (dibatasi RLS user_id = auth.uid()). */
export default async function AkunPage() {
  const { sb, user, role } = await getViewer();
  if (!sb || !user) redirect('/masuk?next=/akun');

  const [profile, reports, pledges, sims] = await Promise.all([
    sb.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    sb.from('reports').select('id, created_at, category, place, status, review_note').order('created_at', { ascending: false }).limit(50),
    sb.from('aid_pledges').select('code, created_at, campaign_key, aid_type, quantity, status').order('created_at', { ascending: false }).limit(50),
    sb.from('simulations').select('id, created_at, label, wind_ms, scenarios(name)').order('created_at', { ascending: false }).limit(30),
  ]);

  const data: AccountData = {
    email: user.email ?? '',
    name: (profile.data?.display_name as string | null | undefined) ?? null,
    role,
    // Bila migrasi 0007 belum dijalankan, kolom user_id belum ada: daftar kosong, bukan galat.
    reports: (reports.data as AccountData['reports'] | null) ?? [],
    pledges: (pledges.data as AccountData['pledges'] | null) ?? [],
    simulations: ((sims.data as unknown as RawSim[] | null) ?? []).map((s) => ({
      id: s.id,
      created_at: s.created_at,
      label: s.label,
      wind_ms: Number(s.wind_ms),
      scenario: (Array.isArray(s.scenarios) ? s.scenarios[0]?.name : s.scenarios?.name) ?? null,
    })),
  };
  return <AccountView data={data} />;
}

interface RawSim {
  id: string;
  created_at: string;
  label: string | null;
  wind_ms: number | string;
  scenarios: { name: string } | { name: string }[] | null;
}
