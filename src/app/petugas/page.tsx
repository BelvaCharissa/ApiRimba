import type { Metadata } from 'next';
import OfficerView from '@/components/petugas/OfficerView';

export const metadata: Metadata = {
  title: 'Petugas',
  robots: { index: false, follow: false },
};

export default function PetugasPage() {
  return <OfficerView />;
}
