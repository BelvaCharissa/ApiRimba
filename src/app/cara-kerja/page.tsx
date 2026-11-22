import type { Metadata } from 'next';
import FireToy from '@/components/carakerja/FireToy';
import LevelSlider from '@/components/carakerja/LevelSlider';
import PageGuide from '@/components/guide/PageGuide';
import StepShowcase from '@/components/guide/StepShowcase';
import {
  ArtAid,
  ArtBriefing,
  ArtCamera,
  ArtCheck,
  ArtFirebreak,
  ArtMapClick,
  ArtOfficer,
  ArtSatellite,
  ArtTimeline,
  ArtTrack,
  ArtTruck,
  ArtVillages,
  ArtWind,
} from '@/components/guide/art';
import { IconArrowRight, IconChevron } from '@/components/ui/icons';
import { ButtonLink } from '@/components/ui/primitives';
import SiteFooter from '@/components/ui/SiteFooter';
import SiteHeader from '@/components/ui/SiteHeader';
import { getLang, getT } from '@/lib/i18n-server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'id' ? 'Cara kerja' : 'How it works' };
}

/** Bagian lipat: judul selalu terlihat, isi dibuka dengan klik. */
function Fold({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="glass group rounded-[20px] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-lg font-semibold text-ink">
        {title}
        <IconChevron size={18} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-5 pb-5 text-[15px] leading-7 text-ink-2">{children}</div>
    </details>
  );
}

export default async function CaraKerjaPage() {
  const t = await getT();

  const flow = [
    {
      art: <ArtSatellite />,
      title: t('Satellites spot the heat', 'Satelit menangkap panas'),
      body: t('NASA satellites pass over Indonesia several times a day and mark every hot spot.', 'Satelit NASA melintasi Indonesia beberapa kali sehari dan menandai tiap titik panas.'),
      points: [t('Refreshed at most every 30 minutes', 'Diperbarui paling lama tiap 30 menit'), t('Nearby hotspots are grouped into one incident with a 0-100 priority', 'Titik berdekatan dikelompokkan jadi satu kejadian dengan prioritas 0-100')],
    },
    {
      art: <ArtMapClick />,
      title: t('You pick a hotspot', 'Anda memilih satu titik'),
      body: t('Tap any hotspot. The app builds a 16 x 16 km area around it from real land-cover imagery, elevation and villages.', 'Ketuk titik panas mana pun. Aplikasi membangun area 16 x 16 km di sekitarnya dari citra tutupan lahan, elevasi, dan desa nyata.'),
    },
    {
      art: <ArtWind />,
      title: t('Wind and dryness are added', 'Angin dan kekeringan dimasukkan'),
      body: t('Live weather at that spot. If the wind on the ground is different, change it and the result follows.', 'Cuaca langsung di titik itu. Kalau angin di lapangan berbeda, ubah saja; hasilnya ikut berubah.'),
    },
    {
      art: <ArtTimeline />,
      title: t('12 hours are simulated', '12 jam disimulasikan'),
      body: t('Every 15 minutes a burning cell can light its 8 neighbours. Run 12 times with random variation.', 'Tiap 15 menit, sel yang terbakar bisa menyalakan 8 tetangganya. Diulang 12 kali dengan variasi acak.'),
      points: [t('Faster downwind, uphill, in dry fuel and on peat', 'Lebih cepat searah angin, menanjak, di bahan kering, dan di gambut'), t('Rivers and canals slow or stop it', 'Sungai dan kanal memperlambat atau menghentikannya')],
    },
    {
      art: <ArtVillages />,
      title: t('Villages get a level', 'Desa diberi level'),
      body: t('The estimated arrival time decides the level. Try the slider below.', 'Perkiraan jam tiba api menentukan levelnya. Coba geser penggeser di bawah.'),
    },
    {
      art: <ArtFirebreak />,
      title: t('225 firebreaks are tested', '225 sekat bakar diuji'),
      body: t('The app draws candidate lines ahead of the fire, simulates each one, and keeps the best three that can be built in time.', 'Aplikasi menggambar garis kandidat di depan api, menyimulasikan tiap garis, lalu memilih tiga terbaik yang sempat dibangun.'),
    },
    {
      art: <ArtBriefing />,
      title: t('AI writes the briefing', 'AI menyusun briefing'),
      body: t('Gemini turns the numbers into priority actions. It is told not to invent numbers; the report can be printed.', 'Gemini mengubah angka jadi prioritas tindakan. Gemini dilarang mengarang angka; laporannya bisa dicetak.'),
    },
  ];

  const report = [
    { art: <ArtCamera />, title: t('Live photo + stamp', 'Foto langsung + cap'), body: t('Date, time, coordinates and province are printed onto the photo.', 'Tanggal, jam, koordinat, dan provinsi dicetak di foto.') },
    { art: <ArtCheck />, title: t('AI and satellite check', 'Cek AI dan satelit'), body: t('AI confirms fire, smoke or burnt land. A satellite hotspot within 5 km raises trust.', 'AI memastikan ada api, asap, atau lahan terbakar. Titik panas satelit dalam 5 km menambah kepercayaan.') },
    { art: <ArtOfficer />, title: t('Officer confirms', 'Petugas mengonfirmasi'), body: t('A post officer verifies or rejects each report.', 'Petugas posko memverifikasi atau menolak tiap laporan.') },
  ];

  const aid = [
    { art: <ArtAid />, title: t('Pledge', 'Janji'), body: t('Pick goods for a post.', 'Pilih barang untuk posko.') },
    { art: <ArtTruck />, title: t('Deliver', 'Antar'), body: t('The post confirms and receives it.', 'Posko mengonfirmasi dan menerimanya.') },
    { art: <ArtTrack />, title: t('Track', 'Lacak'), body: t('Follow your code until "Distributed".', 'Ikuti kode Anda sampai "Disalurkan".') },
  ];

  return (
    <div className="min-h-dvh bg-paper">
      <div className="grad-canopy">
        <SiteHeader />
        <header className="mx-auto max-w-[1200px] px-4 pb-14 pt-8 sm:px-6">
          <p className="text-center text-sm font-semibold text-leaf">{t('How it works', 'Cara kerja')}</p>
          <h1 className="mx-auto mt-2 max-w-[820px] text-center text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {t('From a satellite hotspot to a firebreak plan.', 'Dari titik panas satelit ke rencana sekat bakar.')}
          </h1>
          <p className="mt-3 text-sm text-ink-3">{t('Tap each step.', 'Ketuk tiap langkah.')}</p>
          <div className="mt-8">
            <StepShowcase steps={flow} label={t('How it works', 'Cara kerja')} />
          </div>
        </header>
      </div>

      <div className="grad-canopy-soft">
        <main className="mx-auto max-w-[1200px] space-y-16 px-4 py-14 sm:px-6">
          <section aria-labelledby="coba">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="coba" className="text-3xl font-bold tracking-tight text-ink">
                  {t('Try it yourself', 'Coba sendiri')}
                </h2>
                <p className="mt-1 max-w-[760px] text-ink-2">
                  {t('Use the real example below: start the fire, choose the wind, draw a firebreak, then play through 12 hours.', 'Gunakan contoh nyata di bawah: nyalakan api, pilih arah angin, gambar sekat, lalu putar sepanjang 12 jam.')}
                </p>
              </div>
              <span className="rounded-full bg-sun/15 px-3 py-1.5 text-xs font-bold text-sun">
                {t('Interactive 12-hour example', 'Contoh interaktif 12 jam')}
              </span>
            </div>
            <div className="mt-5">
              <FireToy />
            </div>
          </section>

          <section aria-labelledby="level">
            <h2 id="level" className="text-3xl font-bold tracking-tight text-ink">
              {t('Village levels', 'Level desa')}
            </h2>
            <p className="mt-1 text-ink-2">{t('Drag to change the arrival time.', 'Geser untuk mengubah jam tiba.')}</p>
            <div className="mt-5">
              <LevelSlider />
            </div>
          </section>

          <section aria-labelledby="warna">
            <h2 id="warna" className="text-3xl font-bold tracking-tight text-ink">
              {t('Map colours', 'Warna di peta')}
            </h2>
            <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {(
                [
                  ['#ffd43b', t('Flaming', 'Menyala'), t('Active surface fire, moves fastest.', 'Api aktif di permukaan, paling cepat.')],
                  ['#c92a2a', t('Smouldering', 'Membara'), t('Peat burning below; lasts for hours.', 'Gambut terbakar di bawah; bertahan berjam-jam.')],
                  ['#8a7570', t('Burnt', 'Bekas terbakar'), t('Fire has gone out here.', 'Api sudah padam di sini.')],
                  ['#9775fa', t('Chance of burning', 'Peluang terbakar'), t('Darker = more certain within 12 h.', 'Makin pekat makin pasti dalam 12 jam.')],
                ] as const
              ).map(([c, k, v]) => (
                <li key={k} className="glass overflow-hidden rounded-[18px]">
                  <span className="block h-16" style={{ background: `repeating-linear-gradient(45deg, ${c}, ${c} 10px, ${c}cc 10px, ${c}cc 20px)` }} />
                  <p className="px-4 pt-3 font-semibold text-ink">{k}</p>
                  <p className="px-4 pb-4 text-sm text-ink-2">{v}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="lapor-h">
            <h2 id="lapor-h" className="text-3xl font-bold tracking-tight text-ink">
              {t('How a citizen report is confirmed', 'Cara laporan warga dikonfirmasi')}
            </h2>
            <ol className="mt-5 grid gap-3 md:grid-cols-3">
              {report.map((r, i) => (
                <li key={r.title} className="glass overflow-hidden rounded-[20px]">
                  {r.art}
                  <div className="p-4">
                    <p className="font-semibold text-ink">
                      {i + 1}. {r.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-ink-2">{r.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="bantu-h">
            <h2 id="bantu-h" className="text-3xl font-bold tracking-tight text-ink">
              {t('How aid reaches people', 'Cara bantuan sampai ke warga')}
            </h2>
            <ol className="mt-5 grid gap-3 md:grid-cols-3">
              {aid.map((r, i) => (
                <li key={r.title} className="glass overflow-hidden rounded-[20px]">
                  {r.art}
                  <div className="p-4">
                    <p className="font-semibold text-ink">
                      {i + 1}. {r.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-ink-2">{r.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="detail" className="space-y-3">
            <h2 id="detail" className="text-3xl font-bold tracking-tight text-ink">
              {t('Details for the curious', 'Rincian untuk yang penasaran')}
            </h2>
            <Fold title={t('Firebreak score', 'Skor sekat bakar')}>
              <p>
                <b className="text-ink">{t('Score 0 to 100', 'Skor 0 sampai 100')}</b> = 100 x {t('effectiveness', 'efektivitas')} x {t('time factor', 'faktor waktu')} − 1.5 x {t('length (km)', 'panjang (km)')}.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t('Effectiveness: weighted risk reduction (settlements x100, plantations x10, peat x5, forest x3). A 35% drop counts as full.', 'Efektivitas: penurunan risiko berbobot (permukiman x100, kebun x10, gambut x5, hutan x3). Turun 35% dianggap penuh.')}</li>
                <li>{t('Time factor: time left after 4 hours of building. 3 hours or more left counts as full.', 'Faktor waktu: sisa waktu setelah 4 jam pembangunan. Sisa 3 jam atau lebih bernilai penuh.')}</li>
                <li>{t('A firebreak that cannot be built before the fire arrives is dropped.', 'Sekat yang tidak sempat dibangun sebelum api tiba langsung dibuang.')}</li>
              </ul>
            </Fold>
            <Fold title={t('Where AI is used', 'Di mana AI dipakai')}>
              <p>
                <b className="text-ink">{t('Firebreak search', 'Pencarian sekat')}</b>: {t('simulation-based search in your browser.', 'pencarian berbasis simulasi di browser Anda.')}
              </p>
              <p>
                <b className="text-ink">Briefing</b>: {t('Gemini writes priority actions from the simulation numbers, without inventing new ones.', 'Gemini menyusun prioritas tindakan dari angka simulasi, tanpa mengarang angka baru.')}
              </p>
              <p>
                <b className="text-ink">{t('Photo check', 'Cek foto')}</b>: {t('Gemini looks at each report photo and says whether it shows fire, smoke or burnt land. Clearly unrelated photos are rejected.', 'Gemini melihat tiap foto laporan dan menilai apakah berisi api, asap, atau lahan terbakar. Foto yang jelas tidak berhubungan ditolak.')}
              </p>
              <p>
                <b className="text-ink">{t('Assistant', 'Asisten')}</b>: {t('"Ask AI" answers questions using today’s hotspot summary.', '"Tanya AI" menjawab pertanyaan memakai ringkasan titik panas hari ini.')}
              </p>
            </Fold>
            <Fold title={t('Data sources', 'Sumber data')}>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t('Hotspots: NASA FIRMS (VIIRS and MODIS).', 'Titik panas: NASA FIRMS (VIIRS dan MODIS).')}</li>
                <li>{t('Weather: Open-Meteo (wind, humidity, 14 days of rain).', 'Cuaca: Open-Meteo (angin, kelembapan, hujan 14 hari).')}</li>
                <li>{t('Land cover: Esri Sentinel-2 10 m. Terrain: AWS Terrarium. Villages and services: OpenStreetMap.', 'Tutupan lahan: Esri Sentinel-2 10 m. Relief: AWS Terrarium. Desa dan layanan: OpenStreetMap.')}</li>
                <li>{t('If a source fails, the app falls back to stored data.', 'Bila sumber gagal, aplikasi memakai data cadangan.')}</li>
              </ul>
            </Fold>
            <Fold title={t('Limits', 'Batasan')}>
              <ul className="list-disc space-y-1 pl-5">
                <li>{t('Model coefficients were tuned visually, not calibrated against historical fires.', 'Koefisien model ditala secara visual, belum dikalibrasi dengan kebakaran historis.')}</li>
                <li>{t('Peat is estimated from elevation and land cover.', 'Gambut diperkirakan dari elevasi dan tutupan lahan.')}</li>
                <li>{t('Wind is assumed constant for 12 hours.', 'Angin dianggap tetap selama 12 jam.')}</li>
                <li>{t('Aid needs are estimates from hotspot counts, not official requests.', 'Kebutuhan bantuan diperkirakan dari jumlah titik panas, bukan permintaan resmi.')}</li>
              </ul>
              <p className="rounded-[12px] bg-black/25 p-4 text-ink">
                {t('Results support decisions; they do not replace judgement in the field.', 'Hasil membantu keputusan, bukan pengganti penilaian di lapangan.')}
              </p>
            </Fold>
          </section>

          <div>
            <ButtonLink href="/peta" size="lg">
              {t('Open the map', 'Buka peta')} <IconArrowRight size={18} />
            </ButtonLink>
          </div>
        </main>
        <SiteFooter />
      </div>
      <PageGuide id="cara-kerja" title={t('How it works', 'Cara kerja')} steps={flow.slice(0, 4)} auto={false} />
    </div>
  );
}
