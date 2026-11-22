import Image from 'next/image';

/**
 * Logo resmi ApiRimba, utuh dan tidak dipotong (Logo.png, diolah oleh scripts/build-logo.mjs):
 *  - logo-sticker.png     : logo lengkap, latar dihapus, garis tepi putih agar terbaca di latar gelap
 *  - logo-transparent.png : logo lengkap, latar dihapus, tanpa garis tepi
 *  - logo-full.png        : logo lengkap berlatar putih (laporan cetak)
 */
const RATIO = 676 / 900;

/** Logo lengkap untuk latar gelap. `height` dalam piksel. */
export function Logo({ height = 52, className = '', priority = false }: { height?: number; className?: string; priority?: boolean }) {
  const width = Math.round(height / RATIO);
  return (
    <Image
      src="/brand/logo-sticker.png"
      alt="ApiRimba, Pantau Persebaran Api Hutan"
      width={width}
      height={height}
      priority={priority}
      className={`shrink-0 select-none ${className}`}
      style={{ width, height }}
    />
  );
}

/** Tulisan "Api Rimba" mengikuti logo: Api oranye-merah, Rimba terang. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="bg-[linear-gradient(180deg,#ff9a3c,#e8431c)] bg-clip-text text-transparent">Api</span>
      <span>Rimba</span>
    </span>
  );
}

/** Logo lengkap untuk latar gelap, diatur dari lebar. */
export function LogoEmblem({ width = 220, className = '' }: { width?: number; className?: string }) {
  return <Logo height={Math.round(width * RATIO)} className={className} />;
}

/** Logo lengkap berlatar putih (untuk dokumen cetak). */
export function LogoFull({ width = 160, className = '' }: { width?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo-full.png"
      alt="ApiRimba, Pantau Persebaran Api Hutan"
      width={width}
      height={Math.round((width * 1081) / 1455)}
      className={className}
    />
  );
}
