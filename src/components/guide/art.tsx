/**
 * Gambar ilustrasi untuk beranda, cara kerja, dan panduan langkah: screenshot asli ApiRimba
 * (peta titik panas, simulasi skenario Riau, formulir lapor, posko bantuan), dipotong 4:3.
 * Dibuat ulang dengan scripts/build-guide-shots.mjs. Dekoratif: teks di sebelahnya yang menjelaskan.
 */
import Image from 'next/image';

function Shot({ name, className = '' }: { name: string; className?: string }) {
  return (
    <Image
      src={`/img/guide/${name}.webp`}
      alt=""
      aria-hidden="true"
      width={960}
      height={720}
      sizes="(max-width: 768px) 100vw, 480px"
      className={`block aspect-[4/3] h-auto w-full bg-[#0a1a12] object-cover ${className}`}
    />
  );
}

/** Peta titik panas satelit se-Indonesia. */
export const ArtSatellite = () => <Shot name="satellite" />;
/** Kartu detail setelah satu titik panas diketuk. */
export const ArtMapClick = () => <Shot name="map-click" />;
/** Panel kondisi: cuaca langsung dan arah angin. */
export const ArtWind = () => <Shot name="wind" />;
/** Sebaran jam ke-6 dengan bilah waktu. */
export const ArtTimeline = () => <Shot name="timeline" />;
/** Desa dengan perkiraan jam tiba api. */
export const ArtVillages = () => <Shot name="villages" />;
/** Api menjalar ke desa searah angin. */
export const ArtWindTurn = () => <Shot name="wind-turn" />;
/** Jam-jam awal: api di zona gambut (arsir) dan peluang terbakar (ungu). */
export const ArtPeat = () => <Shot name="peat" />;
/** Sekat bakar A1-A2 di depan api. */
export const ArtFirebreak = () => <Shot name="firebreak" />;
/** Perbandingan: sekat memangkas area terbakar. */
export const ArtCompare = () => <Shot name="compare" />;
/** Laporan siap cetak untuk posko. */
export const ArtBriefing = () => <Shot name="briefing" />;
/** Formulir lapor: buka kamera atau pilih dari galeri. */
export const ArtCamera = () => <Shot name="camera" />;
/** Peta lokasi laporan dengan pin. */
export const ArtPin = () => <Shot name="pin" />;
/** Foto bercap tanggal, jam, koordinat, dan provinsi. */
export const ArtCheck = () => <Shot name="check" />;
/** Semua langkah lengkap, siap dikirim untuk ditinjau petugas. */
export const ArtOfficer = () => <Shot name="officer" />;
/** Pilihan jenis bantuan. */
export const ArtAid = () => <Shot name="aid" />;
/** Cara pengiriman bantuan. */
export const ArtTruck = () => <Shot name="truck" />;
/** Posko: dijanjikan dan sudah disalurkan. */
export const ArtTrack = () => <Shot name="track" />;
