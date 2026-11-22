import type { Metadata } from 'next';
import { Suspense } from 'react';
import SignInView from '@/components/auth/SignInView';
import { getLang } from '@/lib/i18n-server';

export async function generateMetadata(): Promise<Metadata> {
  const id = (await getLang()) === 'id';
  return { title: id ? 'Masuk' : 'Sign in', robots: { index: false, follow: false } };
}

export default function MasukPage() {
  return (
    <Suspense fallback={<div className="grad-canopy min-h-dvh" />}>
      <SignInView />
    </Suspense>
  );
}
