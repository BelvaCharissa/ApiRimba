import type { Metadata } from 'next';
import { Suspense } from 'react';
import SignUpView from '@/components/auth/SignUpView';
import { getLang } from '@/lib/i18n-server';

export async function generateMetadata(): Promise<Metadata> {
  const id = (await getLang()) === 'id';
  return { title: id ? 'Daftar' : 'Create account', robots: { index: false, follow: false } };
}

export default function DaftarPage() {
  return (
    <Suspense fallback={<div className="grad-canopy min-h-dvh" />}>
      <SignUpView />
    </Suspense>
  );
}
