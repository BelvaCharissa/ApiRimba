import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6 text-center">
      <div>
        <Logo />
        <h1 className="mt-8 text-3xl font-bold">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-ink-2">Alamat yang Anda buka tidak tersedia.</p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-forest-900 px-5 py-2.5 font-semibold text-white">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
