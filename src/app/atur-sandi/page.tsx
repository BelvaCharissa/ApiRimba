import type { Metadata } from 'next';
import { ResetPasswordView } from '@/components/auth/PasswordViews';
import { getLang } from '@/lib/i18n-server';

export async function generateMetadata(): Promise<Metadata> {
  const id = (await getLang()) === 'id';
  return { title: id ? 'Sandi baru' : 'New password', robots: { index: false, follow: false } };
}

export default function AturSandiPage() {
  return <ResetPasswordView />;
}
