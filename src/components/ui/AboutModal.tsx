'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function AboutModal({ open, onClose, dark }: { open: boolean; onClose: () => void; dark?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const muted = dark ? 'text-text-secondary' : 'text-ink-2';
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="about-title"
      className={`m-auto w-[min(560px,calc(100vw-32px))] rounded-panel p-0 backdrop:bg-black/50 ${
        dark ? 'border border-border-dark bg-bg-elevated text-text-primary' : 'bg-card text-ink shadow-soft'
      }`}
    >
      <div className="max-h-[80vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="about-title" className="text-xl font-semibold">
            Tentang model
          </h2>
          <button onClick={onClose} aria-label="Tutup" className={`rounded-md p-1 ${muted} hover:opacity-80`}>
            <X size={20} />
          </button>
        </div>
        <div className={`space-y-4 text-sm leading-6 ${muted}`}>
          <section>
            <h3 className={`mb-1 font-semibold ${dark ? 'text-text-primary' : 'text-ink'}`}>Cara kerja</h3>
            <p>
              Area dibagi menjadi grid 64 x 64 sel (tiap sel 250 m). Setiap 15 menit, sel yang menyala dapat menyalakan 8
              tetangganya dengan peluang yang dipengaruhi angin, lereng, jenis bahan bakar, dan kekeringan (model cellular
              automata, terinspirasi Alexandridis dkk., 2008). Simulasi dijalankan 12 kali (Monte Carlo) untuk menghasilkan
              peta peluang terbakar dan estimasi waktu tiba api.
            </p>
          </section>
          <section>
            <h3 className={`mb-1 font-semibold ${dark ? 'text-text-primary' : 'text-ink'}`}>Komponen AI</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>Optimasi sekat bakar:</b> sistem membuat ratusan kandidat garis sekat, mensimulasikan ulang masing-masing,
                lalu memilih tiga yang paling menurunkan risiko dengan margin waktu cukup untuk dibangun.
              </li>
              <li>
                <b>AI Briefing (Gemini):</b> model bahasa merangkum hasil simulasi menjadi briefing situasi dan prioritas
                tindakan berbahasa Indonesia. Bila layanan tidak tersedia, dipakai briefing cadangan berbasis aturan.
              </li>
            </ul>
          </section>
          <section>
            <h3 className={`mb-1 font-semibold ${dark ? 'text-text-primary' : 'text-ink'}`}>Asumsi dan batasan</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Koefisien model adalah nilai awal yang ditala secara visual, belum dikalibrasi dengan data kebakaran historis.</li>
              <li>Tutupan lahan, zona gambut, dan desa pada tiga skenario adalah ilustrasi; nama desa fiktif.</li>
              <li>Angin dianggap seragam di seluruh area selama 12 jam.</li>
              <li>Gambut kering dapat menyala lebih lama dan menembus sekat permukaan (api bawah tanah).</li>
            </ul>
          </section>
          <section>
            <h3 className={`mb-1 font-semibold ${dark ? 'text-text-primary' : 'text-ink'}`}>Sumber data</h3>
            <p>
              Titik panas: NASA FIRMS (VIIRS). Cuaca dan angin: Open-Meteo. Relief: Terrarium (AWS Open Data). Peta dasar:
              CARTO, OpenStreetMap.
            </p>
          </section>
          <p className={`rounded-card p-3 text-xs ${dark ? 'bg-bg-surface' : 'bg-forest-100 text-forest-900'}`}>
            Prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan.
          </p>
        </div>
      </div>
    </dialog>
  );
}
