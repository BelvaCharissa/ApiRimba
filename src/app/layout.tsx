import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

// Plus Jakarta Sans (Tokotype, Indonesia) untuk antarmuka; Bricolage Grotesque hanya untuk judul besar;
// JetBrains Mono hanya untuk koordinat dan ID.
const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], display: 'swap' });
const bricolage = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'], display: 'swap' });
const jetbrains = JetBrains_Mono({ variable: '--font-jetbrains', subsets: ['latin'], display: 'swap', weight: ['400', '500'] });

export const metadata: Metadata = {
  title: {
    default: 'ApiRimba AI: prediksi sebaran api gambut 12 jam',
    template: '%s · ApiRimba AI',
  },
  description:
    'Prediksi ke mana api menjalar di lahan gambut, kapan api tiba di tiap desa, dan di mana sekat bakar paling efektif. Untuk Manggala Agni dan BPBD.',
};

export const viewport: Viewport = {
  themeColor: '#f5f6f2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${bricolage.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
