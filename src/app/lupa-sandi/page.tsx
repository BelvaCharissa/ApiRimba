import type { Metadata } from 'next';
import { ForgotPasswordView } from '@/components/auth/PasswordViews';
import { getLang } from '@/lib/i18n-server';

export async function generateMetadata(): Promise<Metadata> {
  const id = (await getLang()) === 'id';
  return { title: id ? 'Lupa sandi' : 'Forgot password', robots: { index: false, follow: false } };
}

export default function LupaSandiPage() {
  return <ForgotPasswordView />;
}
