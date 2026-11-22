/**
 * Gambar ilustrasi untuk beranda, cara kerja, dan panduan langkah: screenshot asli ApiRimba
 * (peta titik panas, simulasi skenario Riau, formulir lapor, posko bantuan), dipotong 4:3.
 * Dibuat ulang dengan scripts/build-guide-shots.mjs. Dekoratif: teks di sebelahnya yang menjelaskan.
 */
import Image from 'next/image';

function Shot({ name, alt, className = '' }: { name: string; alt: string; className?: string }) {
  return (
    <Image
      src={`/img/guide/${name}.webp`}
      alt={alt}
      width={960}
      height={720}
      sizes="(max-width: 768px) 100vw, 480px"
      className={`block aspect-[16/10] h-auto w-full bg-[#0a1a12] object-cover ${className}`}
    />
  );
}

/** Peta titik panas satelit se-Indonesia. */
export const ArtSatellite = () => <Shot name="satellite" alt="Peta titik panas satelit Indonesia" />;
/** Kartu detail setelah satu titik panas diketuk. */
export const ArtMapClick = () => <Shot name="map-click" alt="Contoh kartu detail titik panas" />;
/** Panel kondisi: cuaca langsung dan arah angin. */
export const ArtWind = () => <Shot name="wind" alt="Contoh kondisi angin dan cuaca Riau" />;
/** Sebaran jam ke-6 dengan bilah waktu. */
export const ArtTimeline = () => <Shot name="timeline" alt="Contoh sebaran api pada jam keenam" />;
/** Desa dengan perkiraan jam tiba api. */
export const ArtVillages = () => <Shot name="villages" alt="Contoh perkiraan waktu tiba api di desa" />;
/** Api menjalar ke desa searah angin. */
export const ArtWindTurn = () => <Shot name="wind-turn" alt="Contoh perubahan arah sebaran api" />;
/** Jam-jam awal: api di zona gambut (arsir) dan peluang terbakar (ungu). */
export const ArtPeat = () => <Shot name="peat" alt="Contoh api membara di zona gambut" />;
/** Sekat bakar A1-A2 di depan api. */
export const ArtFirebreak = () => <Shot name="firebreak" alt="Contoh lokasi garis sekat bakar" />;
/** Perbandingan: sekat memangkas area terbakar. */
export const ArtCompare = () => <Shot name="compare" alt="Contoh perbandingan dampak sekat bakar" />;
/** Laporan siap cetak untuk posko. */
export const ArtBriefing = () => <Shot name="briefing" alt="Contoh laporan briefing untuk posko" />;
/** Formulir lapor: buka kamera atau pilih dari galeri. */
export const ArtCamera = () => <Shot name="camera" alt="Contoh formulir foto laporan" />;
/** Peta lokasi laporan dengan pin. */
export const ArtPin = () => <Shot name="pin" alt="Contoh penentuan lokasi laporan" />;
/** Foto bercap tanggal, jam, koordinat, dan provinsi. */
export const ArtCheck = () => <Shot name="check" alt="Contoh foto laporan dengan cap lokasi" />;
/** Semua langkah lengkap, siap dikirim untuk ditinjau petugas. */
export const ArtOfficer = () => <Shot name="officer" alt="Contoh laporan siap ditinjau petugas" />;
/** Pilihan jenis bantuan. */
export const ArtAid = () => <Shot name="aid" alt="Contoh pilihan jenis bantuan" />;
/** Cara pengiriman bantuan. */
export const ArtTruck = () => <Shot name="truck" alt="Contoh cara pengiriman bantuan" />;
/** Posko: dijanjikan dan sudah disalurkan. */
export const ArtTrack = () => <Shot name="track" alt="Contoh status dan pelacakan bantuan" />;
