import type { Metadata } from 'next';
import { Suspense } from 'react';
import PetaView from '@/components/pantau/PetaView';

export const metadata: Metadata = {
  title: 'Peta',
  description: 'Titik panas satelit se-Indonesia secara langsung. Klik titik mana pun untuk menyimulasikan sebaran api, sekat bakar, dan rencana respons di lokasi itu.',
};

export default function PetaPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <PetaView />
    </Suspense>
  );
}
