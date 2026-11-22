import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import ChatWidget from '@/components/chat/ChatWidget';
import EmergencyBar from '@/components/ui/EmergencyBar';
import { LangProvider } from '@/components/i18n/LangProvider';
import { getLang } from '@/lib/i18n-server';
import './globals.css';

// Satu huruf untuk semua teks: Plus Jakarta Sans (Tokotype, Indonesia). Angka memakai tabular-nums.
const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const id = (await getLang()) === 'id';
  return {
    title: {
      default: id ? 'ApiRimba: prediksi sebaran api gambut 12 jam' : 'ApiRimba: 12-hour peat fire spread forecast',
      template: '%s · ApiRimba',
    },
    description: id
      ? 'Ke mana api menjalar di lahan gambut, kapan tiba di tiap desa, di mana sekat bakar paling efektif, dan bantuan apa yang dibutuhkan.'
      : 'Where a peat fire will spread, when it reaches each village, where firebreaks work best, and what help is needed on the ground.',
  };
}

export const viewport: Viewport = {
  themeColor: '#0b1d15',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <LangProvider lang={lang}>
          {children}
          <ChatWidget />
          <EmergencyBar />
        </LangProvider>
      </body>
    </html>
  );
}
