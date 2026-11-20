import type { Metadata } from 'next';
import { IconArrowRight } from '@/components/ui/icons';
import { ButtonLink } from '@/components/ui/primitives';
import SiteHeader from '@/components/ui/SiteHeader';

export const metadata: Metadata = { title: 'Cara kerja' };

const FLOW = [
  ['Pilih kondisi', 'Wilayah, titik awal api (bawaan atau klik sendiri di peta), kecepatan dan arah angin, serta kekeringan lahan. Bisa juga satu klik "Pakai cuaca sekarang".'],
  ['Lihat sebaran 12 jam', 'Peta memutar perkembangan api tiap 15 menit. Geser bilah waktu untuk melompat ke jam mana pun.'],
  ['Cari sekat bakar', 'Sistem menguji 225 garis sekat dan memberi tiga lokasi terbaik lengkap dengan koordinat ujung-ujungnya.'],
  ['Briefing dan laporan', 'Gemini menyusun tindakan untuk posko; hasil disimpan sebagai laporan yang bisa dicetak dan dibagikan.'],
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid gap-4 border-t border-line py-10 md:grid-cols-[260px_1fr] md:gap-12">
      <h2 id={`${id}-h`} className="font-display text-2xl font-bold leading-tight tracking-tight text-ink">
        {title}
      </h2>
      <div className="space-y-4 text-[16px] leading-8 text-ink-2">{children}</div>
    </section>
  );
}

function Swatch({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 size-4 shrink-0 rounded-[4px]" style={{ background: color }} />
      <span>
        <b className="text-ink">{label}</b>: {desc}
      </span>
    </li>
  );
}

export default function CaraKerjaPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <SiteHeader />
      <main className="mx-auto max-w-[1080px] px-4 pb-24 pt-10 sm:px-6">
        <header className="max-w-[760px]">
          <p className="text-sm font-semibold text-ember">Cara kerja</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
            Dari titik api ke rencana sekat bakar, dalam empat langkah.
          </h1>
          <p className="mt-4 text-lg leading-8 text-ink-2">
            ApiRimba AI mensimulasikan sebaran kebakaran lahan gambut 12 jam ke depan langsung di browser, lalu memakai simulasi yang
            sama untuk mencari lokasi sekat bakar terbaik.
          </p>
        </header>

        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map(([k, v], i) => (
            <li key={k} className="rounded-[20px] bg-card p-5 shadow-card">
              <span className="num grid size-8 place-items-center rounded-full bg-forest-950 text-sm font-bold text-white">{i + 1}</span>
              <p className="mt-3 font-semibold text-ink">{k}</p>
              <p className="mt-1 text-sm leading-6 text-ink-2">{v}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12">
          <Section id="sebaran" title="Simulasi sebaran">
            <p>
              Area 16 x 16 km dibagi menjadi 4.096 sel berukuran 250 m. Setiap 15 menit, sel yang terbakar dapat menyalakan 8 sel
              tetangganya. Peluangnya naik bila searah angin, menanjak, bahan bakarnya kering, atau berupa gambut.
            </p>
            <p>
              Simulasi diulang 12 kali dengan variasi acak. Dari situ didapat <b className="text-ink">peluang terbakar</b> tiap sel dan{' '}
              <b className="text-ink">perkiraan jam tiba api</b> di tiap desa. Api di luar kotak 16 x 16 km tidak dihitung; batas ini
              ditandai garis putus-putus di peta.
            </p>
          </Section>

          <Section id="warna" title="Membaca warna peta">
            <ul className="space-y-2">
              <Swatch color="#ffd43b" label="Menyala" desc="api aktif di permukaan, bergerak paling cepat." />
              <Swatch color="#c92a2a" label="Membara" desc="gambut yang terbakar lambat di bawah permukaan; bisa bertahan berjam-jam." />
              <Swatch color="#8a7570" label="Bekas terbakar" desc="api sudah padam di sel ini." />
              <Swatch color="#9775fa" label="Ungu" desc="peluang terbakar dalam 12 jam; makin pekat makin pasti." />
            </ul>
          </Section>

          <Section id="level" title="Level desa">
            <p>Level ditentukan dari perkiraan jam tiba api di sekitar desa (radius ±500 m):</p>
            <ul className="space-y-1">
              <li>
                <b className="text-danger-ink">Awas</b>: api tiba kurang dari 4 jam.
              </li>
              <li>
                <b className="text-alert-ink">Siaga</b>: api tiba 4 sampai 8 jam.
              </li>
              <li>
                <b className="text-warn-ink">Waspada</b>: api tiba lebih dari 8 jam.
              </li>
              <li>
                <b className="text-ok-ink">Aman</b>: tidak terjangkau dalam 12 jam.
              </li>
            </ul>
            <p>Di peta, ikon rumah baru berubah merah ketika waktu simulasi mencapai jam tiba api.</p>
          </Section>

          <Section id="sekat" title="Sekat bakar dan skornya">
            <p>
              Sekat bakar adalah jalur yang dibersihkan dari bahan bakar (dan dibasahi di gambut) agar api berhenti. Sistem membuat 225
              garis kandidat di depan arah sebaran api: 5 jarak dari titik api, 3 sudut, 3 panjang, dan 5 posisi geser. Setiap garis
              disimulasikan ulang, lalu dipilih tiga terbaik yang berjarak minimal 1 km satu sama lain.
            </p>
            <p>
              <b className="text-ink">Skor 0 sampai 100</b> = 100 x efektivitas x faktor waktu − 1,5 x panjang (km).
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Efektivitas: penurunan risiko berbobot (permukiman x100, kebun x10, gambut x5, hutan x3). Turun 35% dianggap penuh.</li>
              <li>Faktor waktu: sisa waktu setelah 4 jam pembangunan. Sisa 3 jam atau lebih bernilai penuh.</li>
              <li>Sekat yang tidak sempat dibangun sebelum api tiba langsung dibuang.</li>
            </ul>
            <p>Setiap sekat diberi koordinat titik awal dan akhir (mis. A1 ke A2) agar tim lapangan tahu persis jalurnya.</p>
          </Section>

          <Section id="ai" title="Dua komponen AI">
            <p>
              <b className="text-ink">Optimasi sekat bakar</b>: pencarian berbasis simulasi di atas, berjalan di browser Anda.
            </p>
            <p>
              <b className="text-ink">AI Briefing</b>: Google Gemini membaca angka hasil simulasi (koordinat titik api, desa, jam tiba,
              koordinat sekat) dan menyusun prioritas tindakan untuk lokasi itu. Gemini dilarang mengarang angka. Bila layanan tidak
              tersedia, briefing disusun dengan aturan tetap.
            </p>
          </Section>

          <Section id="data" title="Data dan pembaruan">
            <ul className="list-disc space-y-1 pl-5">
              <li>Titik panas: NASA FIRMS (satelit VIIRS), diambil ulang otomatis paling lama tiap 30 menit.</li>
              <li>Cuaca: Open-Meteo (angin, kelembapan, hujan 14 hari).</li>
              <li>Relief: Terrarium AWS. Peta dasar: CARTO dan OpenStreetMap.</li>
              <li>Bila internet atau sumber data gagal, aplikasi otomatis memakai data cadangan yang tersimpan.</li>
            </ul>
          </Section>

          <Section id="batasan" title="Batasan">
            <ul className="list-disc space-y-1 pl-5">
              <li>Koefisien model ditala secara visual, belum dikalibrasi dengan kebakaran historis.</li>
              <li>Tutupan lahan, gambut, dan desa pada tiga skenario adalah ilustrasi; nama desa fiktif.</li>
              <li>Angin dianggap seragam selama 12 jam.</li>
            </ul>
            <p className="rounded-[12px] bg-sunken p-4 text-ink">
              Hasil adalah prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan.
            </p>
          </Section>
        </div>

        <ButtonLink href="/peta" size="lg" className="mt-6">
          Coba simulator <IconArrowRight size={18} />
        </ButtonLink>
      </main>
    </div>
  );
}
