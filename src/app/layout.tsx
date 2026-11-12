import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const jetbrains = JetBrains_Mono({ variable: '--font-jetbrains', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'ApiRimba AI: Lihat ke mana api menjalar',
    template: '%s · ApiRimba AI',
  },
  description:
    'Simulasi sebaran kebakaran hutan dan lahan gambut 12 jam ke depan, dengan rekomendasi sekat bakar dan AI Briefing untuk tim pemadam.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
