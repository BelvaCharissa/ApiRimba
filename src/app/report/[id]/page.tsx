import type { Metadata } from 'next';
import Report from '@/components/report/Report';

export const metadata: Metadata = { title: 'Laporan simulasi' };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Report id={id} />;
}
