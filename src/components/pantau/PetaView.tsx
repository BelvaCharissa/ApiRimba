'use client';

import { useSearchParams } from 'next/navigation';
import Simulator from '@/components/simulator/Simulator';
import Pantau from './Pantau';

/**
 * Satu halaman peta: tanpa parameter = peta pantau nasional langsung;
 * dengan ?lokasi=lat,lon (titik panas nyata) atau ?scenario= (contoh) = mode simulasi di lokasi itu.
 */
export default function PetaView() {
  const params = useSearchParams();
  const sim = params.has('lokasi') || params.has('scenario');
  return sim ? <Simulator /> : <Pantau />;
}
