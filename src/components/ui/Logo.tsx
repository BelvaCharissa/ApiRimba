import Image from 'next/image';

/**
 * Logo resmi ApiRimba (Logo.png, diolah oleh scripts/build-logo.mjs):
 *  - logo-mark.png   : pin api di atas peta, untuk navigasi
 *  - logo-emblem.png : ilustrasi lengkap tanpa tulisan, latar transparan (tema gelap)
 *  - logo-full.png   : logo lengkap berlatar putih (laporan cetak)
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-block shrink-0 overflow-hidden bg-[#0e2a1c] ring-1 ring-white/10"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
    >
      <Image src="/brand/logo-mark.png" alt="" width={size} height={size} className="size-full object-cover" priority />
    </span>
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

export function Logo({ size = 30 }: { size?: number; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <Wordmark className="text-lg" />
    </span>
  );
}

/** Ilustrasi logo lengkap (pohon, peta, pin, satelit) untuk latar gelap. */
export function LogoEmblem({ width = 220, className = '' }: { width?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo-emblem.png"
      alt="ApiRimba"
      width={width}
      height={Math.round((width * 720) / 1330)}
      className={className}
    />
  );
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
