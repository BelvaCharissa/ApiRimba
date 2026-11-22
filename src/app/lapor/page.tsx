import type { Metadata } from 'next';
import { Suspense } from 'react';
import LaporView from '@/components/lapor/LaporView';
import { getLang } from '@/lib/i18n-server';

export async function generateMetadata(): Promise<Metadata> {
  const id = (await getLang()) === 'id';
  return {
    title: id ? 'Lapor api' : 'Report a fire',
    description: id
      ? 'Kirim foto api atau asap. Laporan dicocokkan otomatis dengan titik panas satelit NASA FIRMS.'
      : 'Send a photo of fire or smoke. Reports are checked automatically against NASA FIRMS satellite hotspots.',
  };
}

export default function LaporPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <LaporView />
    </Suspense>
  );
}
