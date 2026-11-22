import Link from 'next/link';
import PageGuide from '@/components/guide/PageGuide';
import StepShowcase from '@/components/guide/StepShowcase';
import {
  ArtAid,
  ArtBriefing,
  ArtCamera,
  ArtCompare,
  ArtFirebreak,
  ArtMapClick,
  ArtPeat,
  ArtSatellite,
  ArtTimeline,
  ArtVillages,
  ArtWindTurn,
} from '@/components/guide/art';
import LandingHero from '@/components/landing/LandingHero';
import { IconArrowRight } from '@/components/ui/icons';
import { ButtonLink } from '@/components/ui/primitives';
import SiteFooter from '@/components/ui/SiteFooter';
import { getT } from '@/lib/i18n-server';

export default async function Home() {
  const t = await getT();

  const problems = [
    { art: <ArtWindTurn />, title: t('The wind turns', 'Angin berbelok'), body: t('A small shift can swing a fire to a village within hours.', 'Bergeser sedikit, api bisa berbalik ke desa dalam hitungan jam.') },
    { art: <ArtPeat />, title: t('Peat hides fire', 'Gambut menyimpan api'), body: t('Fire creeps under the surface and slips past shallow firebreaks.', 'Api merambat di bawah permukaan dan lolos dari sekat yang dangkal.') },
    { art: <ArtCompare />, title: t('No way to compare', 'Tanpa pembanding'), body: t('Firebreak spots are chosen by experience, with no way to test them.', 'Lokasi sekat dipilih dari pengalaman, tanpa bisa diuji dulu.') },
  ];

  const impact = [
    {
      tag: t('Coast', 'Pesisir'),
      title: t('Coastal peat', 'Gambut pesisir'),
      body: t(
        'Much of the peat in Riau, South Sumatra and Central Kalimantan lies on low coastal plains, next to fishing villages, river mouths and ports. Smoke from one fire can shut harbours and keep boats ashore.',
        'Sebagian besar gambut di Riau, Sumatera Selatan, dan Kalimantan Tengah ada di dataran rendah pesisir, dekat desa nelayan, muara, dan pelabuhan. Asap dari satu kebakaran bisa menutup pelabuhan dan membuat perahu tidak melaut.',
      ),
    },
    {
      tag: t('Tropical forest', 'Hutan tropis'),
      title: t('Carbon kept in the ground', 'Karbon tetap di tanah'),
      body: t(
        'Tropical peat holds far more carbon per hectare than the forest above it. Every simulation estimates the CO₂ a fire would release and how much a firebreak avoids.',
        'Gambut tropis menyimpan karbon per hektare jauh lebih banyak daripada hutan di atasnya. Tiap simulasi memperkirakan CO₂ yang dilepas api dan berapa yang dicegah sekat bakar.',
      ),
    },
    {
      tag: t('Community', 'Masyarakat'),
      title: t('Residents on the front line', 'Warga di garis depan'),
      body: t(
        'Residents report fires with a photo, each village sees when fire may arrive, and donors send exactly what the posts need. No account is needed to report.',
        'Warga melapor api dengan foto, tiap desa tahu kapan api bisa tiba, dan donatur mengirim persis yang dibutuhkan posko. Melapor tidak perlu akun.',
      ),
    },
  ];

  const ai = [
    [t('Briefing', 'Briefing'), t('Gemini turns a simulation into priority actions for the command post.', 'Gemini mengubah hasil simulasi jadi prioritas tindakan untuk posko.')],
    [t('Photo check', 'Cek foto'), t('Gemini checks each citizen photo for flames, smoke or burnt land before an officer reviews it.', 'Gemini memeriksa foto warga: ada api, asap, atau lahan terbakar, sebelum dicek petugas.')],
    [t('Assistant', 'Asisten'), t('Answers residents’ questions in plain language, with emergency numbers.', 'Menjawab pertanyaan warga dengan bahasa sederhana, lengkap dengan nomor darurat.')],
  ] as const;

  const sdgs = [
    t('SDG 11 Resilient communities', 'SDG 11 Komunitas tangguh'),
    t('SDG 13 Climate action', 'SDG 13 Aksi iklim'),
    t('SDG 15 Life on land', 'SDG 15 Ekosistem daratan'),
  ];

  const steps = [
    {
      art: <ArtSatellite />,
      title: t('Open the live hotspot map', 'Buka peta titik panas'),
      body: t('Every satellite hotspot in Indonesia from the last 72 hours, grouped into incidents and ranked by priority.', 'Semua titik panas satelit di Indonesia 72 jam terakhir, dikelompokkan jadi kejadian dan diurutkan prioritasnya.'),
      href: '/peta',
      cta: t('Open the map', 'Buka peta'),
    },
    {
      art: <ArtMapClick />,
      title: t('Tap a hotspot', 'Ketuk satu titik panas'),
      body: t('See wind, air quality, nearby water and fire stations, then press "Simulate".', 'Lihat angin, kualitas udara, sumber air dan damkar terdekat, lalu tekan "Simulasikan".'),
    },
    {
      art: <ArtTimeline />,
      title: t('Watch 12 hours of spread', 'Tonton sebaran 12 jam'),
      body: t('Press play or drag the time bar. Change the wind and the fire follows.', 'Tekan putar atau geser bilah waktu. Ubah angin, api ikut berubah.'),
    },
    {
      art: <ArtVillages />,
      title: t('See which village is at risk', 'Lihat desa yang terancam'),
      body: t('Each village gets an arrival time and a level: Safe, Watch, Alert or Danger.', 'Tiap desa dapat jam tiba api dan level: Aman, Waspada, Siaga, atau Awas.'),
    },
    {
      art: <ArtFirebreak />,
      title: t('Pick the best firebreak', 'Pilih sekat bakar terbaik'),
      body: t('Three tested firebreak lines with start and end coordinates for the crew.', 'Tiga garis sekat yang sudah diuji, lengkap dengan koordinat awal dan akhir untuk regu.'),
    },
    {
      art: <ArtBriefing />,
      title: t('Print the briefing', 'Cetak briefing'),
      body: t('AI writes the priority actions; save and share the report with the command post.', 'AI menyusun prioritas tindakan; simpan dan bagikan laporannya ke posko.'),
    },
  ];

  const data = [
    ['NASA FIRMS', t('satellite hotspots', 'titik panas satelit')],
    ['Open-Meteo', t('wind and rain', 'angin dan hujan')],
    ['OpenStreetMap', t('villages, rivers, services', 'desa, sungai, layanan')],
    ['Esri', t('land cover imagery', 'citra tutupan lahan')],
    ['Gemini', t('briefing and photo check', 'briefing dan cek foto')],
    [t('Citizens', 'Warga'), t('photo reports', 'laporan berfoto')],
  ];

  const guide = [
    { art: <ArtSatellite />, title: t('Welcome to ApiRimba', 'Selamat datang di ApiRimba'), body: t('ApiRimba shows where forest and peat fires are now, and where they may spread in the next 12 hours.', 'ApiRimba menunjukkan di mana api hutan dan gambut sekarang, dan ke mana bisa menjalar 12 jam ke depan.') },
    { art: <ArtMapClick />, title: t('Start from the map', 'Mulai dari peta'), body: t('Open "Map & simulation", tap any orange dot, then press "Simulate" to see the spread there.', 'Buka "Peta & simulasi", ketuk titik oranye mana pun, lalu tekan "Simulasikan" untuk melihat sebarannya.') },
    { art: <ArtCamera />, title: t('See a fire? Report it', 'Melihat api? Laporkan'), body: t('"Report" lets you send a stamped photo. AI and an officer check it.', '"Lapor" untuk mengirim foto bercap tanggal dan lokasi. AI dan petugas memeriksanya.') },
    { art: <ArtAid />, title: t('Want to help? Pledge goods', 'Ingin membantu? Janjikan barang'), body: t('"Give help" shows what each post needs and lets you track your pledge until it is distributed.', '"Bantu" menunjukkan kebutuhan tiap posko dan bantuan Anda bisa dilacak sampai disalurkan.') },
  ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper">
      <LandingHero />

      <div className="grad-canopy-soft">
        {/* Masalah */}
        <section className="mx-auto max-w-[1200px] px-4 pb-16 pt-20 sm:px-6" aria-labelledby="masalah">
          <p className="text-sm font-semibold text-leaf">{t('Why we built it', 'Kenapa dibuat')}</p>
          <h2 id="masalah" className="mt-2 max-w-[720px] text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {t('Hotspots only tell you where the fire is now.', 'Titik panas cuma bilang di mana api sekarang.')}
          </h2>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {problems.map((p) => (
              <li key={p.title} className="glass overflow-hidden rounded-[22px]">
                {p.art}
                <div className="p-5">
                  <p className="text-xl font-semibold text-ink">{p.title}</p>
                  <p className="mt-1 leading-7 text-ink-2">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Tema: pesisir, hutan tropis, masyarakat, dan peran AI */}
        <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6" aria-labelledby="tema">
          <p className="text-sm font-semibold text-leaf">{t('Coasts, tropical forests and the people who live there', 'Pesisir, hutan tropis, dan warganya')}</p>
          <h2 id="tema" className="mt-2 max-w-[760px] text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {t('Protecting peat keeps carbon in the ground and smoke off the coast.', 'Menjaga gambut berarti menahan karbon dan asap dari pesisir.')}
          </h2>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {impact.map((p) => (
              <li key={p.title} className="glass rounded-[22px] p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-sun">{p.tag}</p>
                <p className="mt-2 text-xl font-semibold text-ink">{p.title}</p>
                <p className="mt-1 leading-7 text-ink-2">{p.body}</p>
              </li>
            ))}
          </ul>

          <div className="glass mt-3 grid gap-5 rounded-[22px] p-5 md:grid-cols-[1fr_1.6fr] md:p-6">
            <div>
              <p className="text-xl font-semibold text-ink">{t('Where AI helps, and where it does not', 'Di mana AI membantu, dan di mana tidak')}</p>
              <p className="mt-1 text-sm leading-6 text-ink-2">
                {t(
                  'Fire spread is calculated by an open physics-and-probability model, so every assumption can be checked. AI does the work people would otherwise do by hand.',
                  'Sebaran api dihitung model fisika-peluang yang asumsinya terbuka dan bisa dicek. AI mengerjakan bagian yang biasanya dikerjakan manual oleh orang.',
                )}
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-3">
              {ai.map(([k, v]) => (
                <li key={k} className="rounded-[16px] bg-white/[0.05] px-4 py-3">
                  <p className="font-semibold text-ink">{k}</p>
                  <p className="mt-0.5 text-sm leading-6 text-ink-3">{v}</p>
                </li>
              ))}
            </ul>
          </div>

          <ul className="mt-4 flex flex-wrap gap-2" aria-label={t('Sustainable Development Goals', 'Tujuan Pembangunan Berkelanjutan')}>
            {sdgs.map((s) => (
              <li key={s} className="rounded-full border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-2">
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* Cara pakai, interaktif */}
        <section className="grad-canopy py-20" aria-labelledby="langkah">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 id="langkah" className="max-w-[560px] text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
                {t('From hotspot to firebreak, step by step.', 'Dari titik api sampai sekat, langkah demi langkah.')}
              </h2>
              <ButtonLink href="/cara-kerja" variant="secondary">
                {t('How it works', 'Cara kerjanya')} <IconArrowRight size={16} />
              </ButtonLink>
            </div>
            <p className="mt-3 text-sm text-ink-3">{t('Tap a step to see it.', 'Ketuk satu langkah untuk melihatnya.')}</p>
            <div className="mt-8">
              <StepShowcase steps={steps} label={t('Steps', 'Langkah')} />
            </div>
          </div>
        </section>

        {/* Lapor & bantu */}
        <section className="mx-auto grid max-w-[1200px] gap-3 px-4 pt-20 sm:px-6 md:grid-cols-2" aria-label={t('Report and help', 'Lapor dan bantu')}>
          <Link href="/lapor" className="glass group overflow-hidden rounded-[24px] hover:bg-white/10">
            <ArtCamera />
            <div className="p-6">
              <h2 className="text-2xl font-bold text-ink">{t('See a fire? Report it with a photo.', 'Melihat api? Laporkan dengan foto.')}</h2>
              <p className="mt-2 leading-7 text-ink-2">
                {t('Date and location are stamped on the photo. AI and an officer check it.', 'Tanggal dan lokasi dicetak di foto. AI dan petugas memeriksanya.')}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 font-semibold text-[#ff9a5c]">
                {t('Report a fire', 'Lapor api')} <IconArrowRight size={16} />
              </span>
            </div>
          </Link>
          <Link href="/bantu" className="glass group overflow-hidden rounded-[24px] hover:bg-white/10">
            <ArtAid />
            <div className="p-6">
              <h2 className="text-2xl font-bold text-ink">{t('Send what the posts actually need.', 'Kirim yang benar-benar dibutuhkan posko.')}</h2>
              <p className="mt-2 leading-7 text-ink-2">
                {t('Pledge goods and track them until they are distributed.', 'Janjikan barang dan lacak sampai disalurkan.')}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 font-semibold text-sun">
                {t('Give help', 'Bantu')} <IconArrowRight size={16} />
              </span>
            </div>
          </Link>
        </section>

        {/* Data */}
        <section id="data" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 py-20 sm:px-6" aria-labelledby="data-h">
          <h2 id="data-h" className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
            {t('Built on open data.', 'Dibangun dari data terbuka.')}
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {data.map(([k, v]) => (
              <li key={k} className="glass rounded-[16px] px-4 py-3">
                <p className="font-semibold text-ink">{k}</p>
                <p className="text-sm text-ink-3">{v}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-[760px] text-sm leading-6 text-ink-3">
            {t(
              'A decision aid, not a replacement for people on the ground. The model is not yet calibrated against past fires, so arrival times are rough estimates.',
              'Alat bantu keputusan, bukan pengganti orang di lapangan. Model belum dikalibrasi dengan kebakaran masa lalu, jadi jam tiba adalah perkiraan kasar.',
            )}
          </p>
        </section>

        {/* Penutup */}
        <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6">
          <div className="grad-sun flex flex-col items-start justify-between gap-8 rounded-[28px] px-6 py-12 sm:px-12 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#1a1300] sm:text-4xl">{t('Try it with today’s hotspots.', 'Coba dengan titik panas hari ini.')}</h2>
              <p className="mt-2 max-w-[480px] text-lg leading-7 text-[#1a1300]/75">{t('No sign-in needed.', 'Tanpa login.')}</p>
            </div>
            <ButtonLink href="/peta" size="lg" className="!bg-none !bg-[#0b1d15] !text-white hover:!bg-[#12341f]">
              {t('Open the map', 'Buka peta')} <IconArrowRight size={18} />
            </ButtonLink>
          </div>
        </section>
        <SiteFooter />
      </div>
      <PageGuide id="beranda" title={t('Getting started', 'Mulai di sini')} steps={guide} />
    </div>
  );
}
