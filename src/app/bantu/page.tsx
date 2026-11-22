import type { Metadata } from 'next';
import { Suspense } from 'react';
import BantuView from '@/components/bantu/BantuView';
import { getLang } from '@/lib/i18n-server';

export async function generateMetadata(): Promise<Metadata> {
  const id = (await getLang()) === 'id';
  return {
    title: id ? 'Bantu' : 'Give help',
    description: id
      ? 'Janjikan masker, air, makanan, P3K, pompa, dan tenda untuk posko di provinsi dengan titik panas aktif.'
      : 'Pledge masks, water, food, first-aid kits, pumps and tents to posts in provinces with active hotspots.',
  };
}

export default function BantuPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <BantuView />
    </Suspense>
  );
}
