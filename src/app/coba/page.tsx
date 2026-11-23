import type { Metadata } from 'next';
import { Suspense } from 'react';
import TryDemoView from '@/components/auth/TryDemoView';
import { getLang } from '@/lib/i18n-server';

export async function generateMetadata(): Promise<Metadata> {
  const id = (await getLang()) === 'id';
  return { title: id ? 'Coba demo' : 'Try the demo', robots: { index: false, follow: false } };
}

/** Pintu masuk satu klik untuk juri dan pengunjung: masuk otomatis dengan akun demo lalu ke peta. */
export default function CobaPage() {
  return (
    <Suspense fallback={<div className="grad-canopy min-h-dvh" />}>
      <TryDemoView />
    </Suspense>
  );
}
