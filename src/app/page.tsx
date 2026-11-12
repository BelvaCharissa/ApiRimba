import IsoScene from '@/components/landing/IsoScene';
import ProductPreview from '@/components/landing/ProductPreview';
import { IconArrowRight } from '@/components/ui/icons';
import { LogoMark } from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/primitives';
import SiteHeader from '@/components/ui/SiteHeader';

const DECISIONS = [
  {
    key: 'Evakuasi',
    title: 'Evakuasi desa mana lebih dulu',
    body: 'Setiap desa mendapat estimasi jam tiba api dan level Aman, Waspada, Siaga, atau Awas. Urutannya berubah begitu angin berubah.',
  },
  {
    key: 'Sekat bakar',
    title: 'Sekat bakar dibangun di mana',
    body: 'Tiga lokasi terbaik dengan persentase area yang terselamatkan dan sisa waktu sebelum api tiba. Terapkan satu, lalu bandingkan berdampingan.',
  },
  {
    key: 'Briefing',
    title: 'Apa yang disampaikan ke posko',
    body: 'Gemini menyusun briefing situasi dan prioritas tindakan dari hasil simulasi, siap dibacakan atau dicetak sebagai laporan.',
  },
];

function DecisionSnippet({ index }: { index: number }) {
  if (index === 0) {
    return (
      <ul className="divide-y divide-line overflow-hidden rounded-[12px] bg-card text-sm shadow-card">
        {[
          ['Sungai Buluh', 'Tiba 5,5 jam', 'Siaga', 'var(--color-alert)'],
          ['Tanjung Harapan', 'Tiba 10,8 jam', 'Waspada', 'var(--color-warn)'],
          ['Pematang Baru', 'Tidak terjangkau', 'Aman', 'var(--color-ok)'],
        ].map(([n, e, l, c]) => (
          <li key={n} className="flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block font-semibold text-ink">{n}</span>
              <span className="num text-ink-3">{e}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink-2">
              <span className="size-2 rounded-full" style={{ background: c }} />
              {l}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (index === 1) {
    return (
      <div className="rounded-[12px] bg-card p-4 shadow-card">
        <p className="font-semibold text-ink">Sekat A</p>
        <dl className="num mt-3 grid grid-cols-3 gap-3 text-sm">
          {[
            ['Area terbakar', '−23%'],
            ['Sisa waktu', '2,5 jam'],
            ['Panjang', '6 km'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-lg font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink-2">Melintasi gambut kering: sertakan pembasahan atau sekat kanal.</p>
      </div>
    );
  }
  return (
    <div className="rounded-[12px] bg-card p-4 text-sm leading-6 shadow-card">
      <p className="font-semibold text-ink">Situasi</p>
      <p className="text-ink-2">
        Angin 6 m/s dari barat daya mendorong api ke timur laut. Sungai Buluh terjangkau pertama, sekitar 5,5 jam lagi.
      </p>
      <p className="mt-2 font-semibold text-ink">Prioritas tindakan</p>
      <p className="text-ink-2">Siapkan jalur evakuasi Sungai Buluh, lalu bangun Sekat A dalam 2,5 jam.</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper">
      <SiteHeader right={<ButtonLink href="/simulator?scenario=riau" size="sm" className="hidden sm:inline-flex">Buka simulator</ButtonLink>} />

      {/* Hero: headline spesifik + produk sungguhan dalam ukuran besar */}
      <section className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-6 lg:pt-20">
        <div className="max-w-[820px]">
          <h1 className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.02em] text-ink sm:text-[64px]">
            Api gambut menjalar ke mana, <span className="text-ember">12 jam sebelum terjadi.</span>
          </h1>
          <p className="mt-6 max-w-[620px] text-lg leading-8 text-ink-2">
            Untuk Manggala Agni dan BPBD: prediksi arah sebaran kebakaran lahan gambut, jam tiba api di tiap desa, dan lokasi
            sekat bakar yang paling banyak menyelamatkan lahan.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/simulator?scenario=riau" size="lg">
              Buka simulator <IconArrowRight size={18} />
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="ghost" size="lg">
              Lihat titik panas hari ini
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-3">Tanpa login. Simulasi berjalan di browser dalam kurang dari 2 detik.</p>
        </div>

        <div className="mt-14">
          <ProductPreview />
          <p className="mt-4 text-center text-sm text-ink-3">Ganti arah angin di atas: area api dan urutan desa terdampak ikut berubah.</p>
        </div>
      </section>

      {/* Keputusan, bukan proses */}
      <section className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6" aria-labelledby="keputusan">
        <h2 id="keputusan" className="max-w-[720px] font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
          Tiga keputusan lapangan, dijawab dalam tiga menit.
        </h2>
        <ol className="mt-14 space-y-16">
          {DECISIONS.map((d, i) => (
            <li key={d.key} className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <p className="text-sm font-semibold text-ember">
                  <span className="num">0{i + 1}</span> {d.key}
                </p>
                <h3 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-ink">{d.title}</h3>
                <p className="mt-3 max-w-[460px] text-lg leading-8 text-ink-2">{d.body}</p>
              </div>
              <div className="rounded-[24px] bg-sunken p-6 sm:p-10">
                <DecisionSnippet index={i} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Masalah */}
      <section className="bg-card py-24" aria-labelledby="masalah">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 id="masalah" className="font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
              Titik panas hanya menjawab di mana api sekarang.
            </h2>
            <ol className="mt-8 space-y-6">
              {[
                ['Angin', 'Perubahan arah angin dapat membelokkan api ke permukiman dalam hitungan jam.'],
                ['Gambut', 'Api di gambut kering merambat di bawah permukaan dan bisa melewati sekat yang hanya dibuat di atas tanah.'],
                ['Waktu', 'Keputusan sekat dan evakuasi sering diambil dari pengalaman, tanpa pembanding skenario.'],
              ].map(([k, v], i) => (
                <li key={k} className="grid grid-cols-[40px_1fr] gap-3">
                  <span className="num pt-0.5 text-lg font-semibold text-ink-3">0{i + 1}</span>
                  <p className="text-lg leading-8 text-ink-2">
                    <b className="text-ink">{k}.</b> {v}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-[28px] bg-paper p-4 sm:p-8">
            <IsoScene />
          </div>
        </div>
      </section>

      {/* Data & batasan */}
      <section className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6" aria-labelledby="data">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="data" className="font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
              Data terbuka, model yang jujur soal batasnya.
            </h2>
            <p className="mt-4 text-lg leading-8 text-ink-2">
              Hasil adalah prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan. Koefisien model belum
              dikalibrasi dengan data kebakaran historis.
            </p>
          </div>
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {[
              ['NASA FIRMS', 'Titik panas satelit VIIRS hampir waktu nyata.'],
              ['Open-Meteo', 'Angin, kelembapan, dan hujan 14 hari terakhir.'],
              ['Simulasi di browser', '4.096 sel, 48 langkah, 12 run per skenario.'],
              ['Google Gemini', 'Menyusun briefing dari angka hasil simulasi, tanpa mengarang data.'],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-line-strong pt-4">
                <dt className="font-semibold text-ink">{k}</dt>
                <dd className="mt-1 leading-7 text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Penutup */}
      <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6">
        <div className="rounded-[28px] bg-forest-950 px-6 py-16 text-center text-white sm:px-12">
          <h2 className="mx-auto max-w-[640px] font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Coba skenario Riau sekarang.
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-lg leading-8 text-white/80">
            Geser angin, cari sekat terbaik, dan cetak laporan untuk posko. Tiga menit, tanpa login.
          </p>
          <ButtonLink href="/simulator?scenario=riau" size="lg" className="mt-8 !bg-white !text-forest-950 hover:!bg-forest-100">
            Buka simulator <IconArrowRight size={18} />
          </ButtonLink>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2 font-semibold text-ink-2">
            <LogoMark size={22} /> ApiRimba AI
          </span>
          <span>Karya IT RUSH 2026. Data: NASA FIRMS, Open-Meteo, OpenStreetMap, CARTO.</span>
        </div>
      </footer>
    </div>
  );
}
