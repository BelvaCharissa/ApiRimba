'use client';

import { useEffect, useRef } from 'react';
import { IconClose } from './icons';

export default function AboutModal({ open, onClose, dark }: { open: boolean; onClose: () => void; dark?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const muted = dark ? 'text-text-secondary' : 'text-ink-2';
  const head = dark ? 'text-text-primary' : 'text-ink';
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="about-title"
      className={`m-auto w-[min(560px,calc(100vw-32px))] rounded-[20px] p-0 backdrop:bg-black/55 ${
        dark ? 'border border-line-dark bg-bg-surface text-text-primary' : 'bg-card text-ink shadow-card'
      }`}
    >
      <div className="max-h-[80vh] overflow-y-auto p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="about-title" className="font-display text-2xl font-bold">
            Cara model bekerja
          </h2>
          <button onClick={onClose} aria-label="Tutup" className={`grid size-9 place-items-center rounded-full ${muted} hover:bg-black/10`}>
            <IconClose />
          </button>
        </div>
        <div className={`space-y-5 text-[15px] leading-7 ${muted}`}>
          <section>
            <h3 className={`mb-1 font-semibold ${head}`}>Simulasi sebaran</h3>
            <p>
              Area 16 x 16 km dibagi menjadi 4.096 sel (250 m). Tiap 15 menit, sel yang menyala dapat menyalakan 8 tetangganya.
              Peluangnya naik searah angin, menanjak lereng, di bahan bakar kering, dan di gambut. Simulasi diulang 12 kali untuk
              memperoleh peluang terbakar dan estimasi waktu tiba api.
            </p>
          </section>
          <section>
            <h3 className={`mb-1 font-semibold ${head}`}>Dua komponen AI</h3>
            <p>
              <b className={head}>Optimasi sekat bakar.</b> Sistem membangkitkan 225 garis kandidat, mensimulasikan ulang
              masing-masing, lalu memilih tiga yang paling menurunkan risiko dan masih sempat dibangun.
            </p>
            <p className="mt-2">
              <b className={head}>AI Briefing.</b> Gemini merangkum hasil menjadi briefing situasi dan prioritas tindakan. Bila
              layanan tidak tersedia, briefing disusun dengan aturan tetap.
            </p>
          </section>
          <section>
            <h3 className={`mb-1 font-semibold ${head}`}>Batasan</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Koefisien ditala secara visual, belum dikalibrasi dengan kebakaran historis.</li>
              <li>Tutupan lahan, gambut, dan desa pada tiga skenario adalah ilustrasi; nama desa fiktif.</li>
              <li>Angin dianggap seragam selama 12 jam.</li>
            </ul>
          </section>
          <section>
            <h3 className={`mb-1 font-semibold ${head}`}>Sumber data</h3>
            <p>NASA FIRMS (titik panas), Open-Meteo (cuaca), Terrarium AWS (relief), CARTO dan OpenStreetMap (peta dasar).</p>
          </section>
          <p className={`rounded-[12px] p-4 text-sm ${dark ? 'bg-bg-base text-text-primary' : 'bg-sunken text-ink'}`}>
            Hasil adalah prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan.
          </p>
        </div>
      </div>
    </dialog>
  );
}
