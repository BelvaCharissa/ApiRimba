import type { Metadata } from 'next';
import { Suspense } from 'react';
import Simulator from '@/components/simulator/Simulator';

export const metadata: Metadata = { title: 'Simulator' };

export default function SimulatorPage() {
  return (
    <Suspense fallback={<div className="theme-sim h-dvh" />}>
      <Simulator />
    </Suspense>
  );
}
