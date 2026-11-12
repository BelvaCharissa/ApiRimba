import {
  ArrowRight,
  BrainCircuit,
  CloudSun,
  Compass,
  FileText,
  Flame,
  LayoutDashboard,
  MapPinned,
  Route,
  Satellite,
  ShieldCheck,
  Sparkles,
  Wind,
} from 'lucide-react';
import Link from 'next/link';
import IsoScene from '@/components/landing/IsoScene';
import { LogoMark } from '@/components/ui/Logo';
import SiteHeader from '@/components/ui/SiteHeader';

const PROBLEMS = [
  {
    icon: Satellite,
    title: 'Titik panas tidak memberi arah',
    body: 'Satelit menunjukkan di mana api berada sekarang, bukan ke mana api akan pergi dalam beberapa jam ke depan.',
  },
  {
    icon: Wind,
    title: 'Angin berubah, api berbelok',
    body: 'Perubahan arah atau kecepatan angin dapat membelokkan api ke permukiman dalam hitungan jam.',
  },
  {
    icon: Flame,
    title: 'Api gambut menembus sekat',
    body: 'Di lahan gambut kering, api merambat di bawah permukaan dan dapat melewati sekat yang hanya dibuat di atas tanah.',
  },
];

const STEPS = [
  {
    n: '01',
    icon: CloudSun,
    title: 'Baca data',
    body: 'Titik panas NASA FIRMS, angin dan hujan dari Open-Meteo, serta zona gambut tiap wilayah.',
  },
  {
    n: '02',
    icon: Compass,
    title: 'Simulasikan 12 jam',
    body: 'Model cellular automata dijalankan 12 kali di browser. Geser angin, area api langsung berubah.',
  },
  {
    n: '03',
    icon: Route,
    title: 'Rekomendasikan sekat',
    body: 'Sistem menguji 225 kandidat sekat bakar dan memilih tiga yang paling menurunkan risiko.',
  },
];

function FloatCard({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute rounded-2xl border border-white/70 bg-white/90 p-3 shadow-[0_12px_32px_rgba(16,41,31,0.14)] backdrop-blur ${className}`}
      style={{ animation: 'float-y 5s ease-in-out infinite' }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
          style={{
            background:
              'radial-gradient(60% 60% at 75% 30%, rgba(255,106,61,0.10), transparent 60%), radial-gradient(50% 50% at 15% 10%, rgba(47,122,87,0.12), transparent 60%)',
          }}
        />
        <SiteHeader
          right={
            <Link
              href="/simulator?scenario=riau"
              className="hidden rounded-full bg-forest-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-700 sm:inline-flex"
            >
              Mulai simulasi
            </Link>
          }
        />

        {/* Hero */}
        <section className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-2">
              <span className="size-1.5 rounded-full bg-cta" />
              Mitigasi bencana · simulasi berbasis AI
            </span>
            <h1 className="mt-5 text-[40px] font-bold leading-[1.08] tracking-tight text-ink sm:text-[56px]">
              Lihat ke mana api menjalar, <span className="text-cta-ink">sebelum api sampai.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-ink-2">
              ApiRimba AI memprediksi sebaran kebakaran hutan dan lahan gambut 12 jam ke depan, lalu merekomendasikan titik
              sekat bakar paling efektif untuk tim pemadam.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/simulator?scenario=riau"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-cta px-6 font-semibold text-white shadow-[0_8px_24px_rgba(255,106,61,0.35)] transition hover:brightness-105"
              >
                Mulai simulasi
                <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-white px-6 font-semibold text-ink transition hover:border-ink-3"
              >
                Lihat dashboard
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                ['12 jam', 'horizon prediksi'],
                ['225', 'kandidat sekat diuji'],
                ['< 2 dtk', 'waktu simulasi'],
              ].map(([v, k]) => (
                <div key={k}>
                  <dt className="sr-only">{k}</dt>
                  <dd className="font-mono text-2xl font-semibold text-ink">{v}</dd>
                  <dd className="text-xs text-ink-3">{k}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="relative rounded-[28px] bg-gradient-to-b from-white to-[#eef3ec] p-4 shadow-soft">
              <IsoScene />
              <FloatCard className="left-3 top-6 w-[200px] sm:left-6">
                <p className="text-[11px] font-medium text-ink-3">Desa Sungai Buluh</p>
                <p className="mt-0.5 font-mono text-lg font-semibold text-ink">Tiba 5,5 jam</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#fff1e6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cta-ink">
                  ◆ Siaga
                </span>
              </FloatCard>
              <FloatCard className="bottom-6 right-3 w-[220px] sm:right-6 [animation-delay:1.2s]">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-forest-100 font-mono text-sm font-bold text-forest-700">
                    55
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Sekat A</p>
                    <p className="font-mono text-xs text-forest-700">luas terbakar −23%</p>
                  </div>
                </div>
              </FloatCard>
              <FloatCard className="right-4 top-4 hidden items-center gap-2 sm:flex [animation-delay:.6s]">
                <Wind size={16} className="text-wind-ink" />
                <span className="font-mono text-xs font-semibold text-ink">6 m/s · barat daya</span>
              </FloatCard>
            </div>
          </div>
        </section>
      </div>

      {/* Masalah */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6" aria-labelledby="masalah">
        <p className="text-sm font-semibold text-cta-ink">Masalahnya</p>
        <h2 id="masalah" className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Tim di lapangan tahu di mana api, tapi belum tahu ke mana api pergi.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <article key={p.title} className="rounded-3xl border border-line bg-white p-6 shadow-soft">
              <span className="grid size-11 place-items-center rounded-2xl bg-[#fff1e6] text-cta-ink">
                <p.icon size={22} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 leading-7 text-ink-2">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Cara kerja */}
      <section className="bg-white py-16" aria-labelledby="cara-kerja">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <p className="text-sm font-semibold text-forest-700">Cara kerja</p>
          <h2 id="cara-kerja" className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Dari data satelit ke keputusan sekat bakar.
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="relative rounded-3xl bg-paper p-6">
                <span className="font-mono text-sm font-semibold text-ink-3">{s.n}</span>
                <span className="mt-4 grid size-11 place-items-center rounded-2xl bg-forest-900 text-white">
                  <s.icon size={22} />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 leading-7 text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Fitur bento */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6" aria-labelledby="fitur">
        <p className="text-sm font-semibold text-cta-ink">Fitur</p>
        <h2 id="fitur" className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Satu layar untuk memutuskan lebih cepat.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-6">
          <article className="relative overflow-hidden rounded-3xl bg-forest-900 p-7 text-white md:col-span-4">
            <MapPinned size={24} className="text-fire-low" />
            <h3 className="mt-5 text-xl font-semibold">Simulator 2.5D dengan partikel angin</h3>
            <p className="mt-2 max-w-md leading-7 text-white/75">
              Geser kecepatan dan arah angin, lalu lihat area merah membesar atau berbelok secara langsung, lengkap dengan
              estimasi jam tiba api di tiap desa.
            </p>
            <div aria-hidden="true" className="absolute -bottom-10 -right-10 size-56 rounded-full bg-cta/30 blur-3xl" />
          </article>
          <article className="rounded-3xl border border-line bg-white p-7 shadow-soft md:col-span-2">
            <Route size={24} className="text-forest-700" />
            <h3 className="mt-5 text-xl font-semibold text-ink">Rekomendasi sekat bakar</h3>
            <p className="mt-2 leading-7 text-ink-2">Tiga lokasi terbaik dengan skor, margin waktu, dan penurunan luas terbakar.</p>
          </article>
          <article className="rounded-3xl border border-line bg-white p-7 shadow-soft md:col-span-2">
            <Sparkles size={24} className="text-wind-ink" />
            <h3 className="mt-5 text-xl font-semibold text-ink">AI Briefing</h3>
            <p className="mt-2 leading-7 text-ink-2">
              Gemini merangkum hasil simulasi menjadi situasi dan prioritas tindakan dalam bahasa Indonesia.
            </p>
          </article>
          <article className="rounded-3xl border border-line bg-white p-7 shadow-soft md:col-span-2">
            <LayoutDashboard size={24} className="text-cta-ink" />
            <h3 className="mt-5 text-xl font-semibold text-ink">Dashboard titik panas</h3>
            <p className="mt-2 leading-7 text-ink-2">Pantau titik panas tiga wilayah dan feed peringatan desa dalam satu halaman.</p>
          </article>
          <article className="rounded-3xl border border-line bg-white p-7 shadow-soft md:col-span-2">
            <FileText size={24} className="text-ink-2" />
            <h3 className="mt-5 text-xl font-semibold text-ink">Laporan siap cetak</h3>
            <p className="mt-2 leading-7 text-ink-2">Simpan hasil, bagikan tautan, dan cetak ke PDF untuk BPBD.</p>
          </article>
        </div>
      </section>

      {/* Data & model */}
      <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6" aria-labelledby="data">
        <div className="grid gap-6 rounded-3xl border border-line bg-white p-7 shadow-soft md:grid-cols-[1fr_1.2fr] md:p-10">
          <div>
            <BrainCircuit size={26} className="text-forest-700" />
            <h2 id="data" className="mt-4 text-2xl font-bold tracking-tight text-ink">
              Sumber data dan catatan model
            </h2>
            <p className="mt-3 leading-7 text-ink-2">
              Hasil adalah prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan. Model belum
              dikalibrasi dengan data kebakaran historis.
            </p>
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ['NASA FIRMS', 'Titik panas VIIRS hampir waktu nyata'],
              ['Open-Meteo', 'Angin, suhu, kelembapan, hujan 14 hari'],
              ['Terrarium (AWS)', 'Relief untuk peta 2.5D'],
              ['Google Gemini', 'Model bahasa untuk AI Briefing'],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-3 rounded-2xl bg-paper p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest-500" />
                <span>
                  <b className="block text-ink">{k}</b>
                  <span className="text-ink-2">{v}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-forest-900 px-7 py-12 text-center text-white sm:px-12">
          <div aria-hidden="true" className="absolute -left-16 -top-16 size-64 rounded-full bg-forest-500/40 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-20 -right-10 size-64 rounded-full bg-cta/30 blur-3xl" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">Coba skenario Riau sekarang.</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-white/75">
            Tanpa login. Geser angin, minta rekomendasi sekat, dan buat AI Briefing dalam kurang dari tiga menit.
          </p>
          <Link
            href="/simulator?scenario=riau"
            className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-cta px-7 font-semibold text-white hover:brightness-105"
          >
            Mulai simulasi <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2">
            <LogoMark size={22} /> ApiRimba AI · IT RUSH 2026
          </span>
          <span>Data: NASA FIRMS, Open-Meteo, OpenStreetMap, CARTO. Hasil adalah prediksi simulasi.</span>
        </div>
      </footer>
    </div>
  );
}
