import Link from 'next/link';
import LandingHero from '@/components/landing/LandingHero';
import { IconAlert, IconArrowRight, IconHand } from '@/components/ui/icons';
import { ButtonLink } from '@/components/ui/primitives';
import SiteFooter from '@/components/ui/SiteFooter';
import { getT } from '@/lib/i18n-server';

export default async function Home() {
  const t = await getT();

  const steps = [
    [t('Mark the fire', 'Tandai titik api'), t('Use today’s satellite hotspots, or tap the map yourself when a report comes in from the field.', 'Pakai titik panas satelit hari ini, atau klik sendiri di peta kalau laporan datang dari lapangan.')],
    [t('Set wind and dryness', 'Isi angin dan kekeringan'), t('Wind comes from the Open-Meteo forecast. If it is different on the ground, change it and the result follows.', 'Angin diambil dari prakiraan Open-Meteo. Kalau di lapangan berbeda, ubah saja; hasilnya ikut berubah.')],
    [t('Read arrival times', 'Baca jam tiba per desa'), t('Each village gets an estimated fire arrival time and a level: Safe, Watch, Alert or Danger.', 'Tiap desa dapat perkiraan jam tiba api dan level Aman, Waspada, Siaga, atau Awas.')],
    [t('Compare firebreaks', 'Bandingkan sekat bakar'), t('Three suggested firebreak lines with coordinates, length, and how much area each one saves.', 'Tiga usulan lokasi sekat, lengkap dengan koordinat, panjang, dan berapa luas yang bisa diselamatkan.')],
  ];

  const problems = [
    [t('The wind turns', 'Angin berbelok'), t('A small shift in wind direction can swing a fire towards a village within hours.', 'Arah angin bergeser sedikit saja, api bisa berbalik ke permukiman dalam beberapa jam.')],
    [t('Peat hides fire', 'Gambut menyimpan api'), t('In dry peat, fire creeps below the surface and can slip past a firebreak dug only at the top.', 'Di gambut kering, api merambat di bawah permukaan dan bisa lolos dari sekat yang hanya digali di atas.')],
    [t('No way to compare', 'Keputusan tanpa pembanding'), t('Firebreak locations and evacuation order are usually decided from experience, with no way to test the options.', 'Lokasi sekat dan urutan evakuasi biasanya diputuskan dari pengalaman, tanpa bisa membandingkan pilihan.')],
  ];

  const data = [
    ['NASA FIRMS', t('VIIRS hotspots, refreshed every few hours.', 'Titik panas VIIRS, diperbarui beberapa jam sekali.')],
    ['Open-Meteo', t('Wind, humidity and 14 days of rainfall.', 'Angin, kelembapan, dan curah hujan 14 hari terakhir.')],
    [t('In-browser simulation', 'Simulasi di browser'), t('4,096 cells, 48 steps of 15 minutes, run 12 times per scenario.', '4.096 sel, 48 langkah per 15 menit, diulang 12 kali per skenario.')],
    ['OpenStreetMap', t('Rivers, canals, fire stations and clinics near each hotspot.', 'Sungai, kanal, damkar, dan puskesmas di sekitar tiap titik panas.')],
    ['Gemini', t('Turns the simulation numbers into a briefing and answers questions. It does not add new numbers.', 'Merangkum angka simulasi jadi briefing dan menjawab pertanyaan. Tidak menambah angka baru.')],
    [t('Citizen reports', 'Laporan warga'), t('Photo reports, checked against satellite hotspots within 5 km.', 'Laporan berfoto, dicocokkan dengan titik panas satelit dalam 5 km.')],
  ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper">
      <LandingHero />

      <div className="grad-canopy-soft">
        {/* Masalah */}
        <section className="mx-auto max-w-[1200px] px-4 pb-20 pt-24 sm:px-6" aria-labelledby="masalah">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
            <div>
              <p className="text-sm font-semibold text-leaf">{t('Why we built it', 'Kenapa dibuat')}</p>
              <h2 id="masalah" className="mt-2 text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
                {t('Hotspots only tell you where the fire is now.', 'Titik panas cuma bilang di mana api sekarang.')}
              </h2>
              <p className="mt-4 max-w-[440px] text-lg leading-8 text-ink-2">
                {t(
                  'A command post needs the next part: where the fire goes, and which village to clear first.',
                  'Posko butuh tahu yang berikutnya: api bergerak ke mana, dan desa mana yang harus dikosongkan lebih dulu.',
                )}
              </p>
            </div>
            <ol className="divide-y divide-line border-y border-line">
              {problems.map(([k, v], i) => (
                <li key={k} className="grid grid-cols-[40px_1fr] gap-2 py-6">
                  <span className="num pt-0.5 text-sm font-semibold text-sun">0{i + 1}</span>
                  <div>
                    <p className="text-xl font-semibold text-ink">{k}</p>
                    <p className="mt-1 text-[16px] leading-7 text-ink-2">{v}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Cara pakai */}
        <section className="grad-canopy py-24 text-white" aria-labelledby="langkah">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 id="langkah" className="max-w-[560px] text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                {t('Four steps, from hotspot to firebreak.', 'Empat langkah, dari titik api sampai sekat.')}
              </h2>
              <ButtonLink href="/cara-kerja" variant="ghost" className="!text-white/80 hover:!bg-white/10 hover:!text-white">
                {t('How the model works', 'Cara modelnya bekerja')} <IconArrowRight size={16} />
              </ButtonLink>
            </div>
            <ol className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(([title, body], i) => (
                <li key={title} className="glass flex flex-col rounded-[20px] p-6">
                  <span className="grad-sun grid size-9 place-items-center rounded-full text-sm font-bold">
                    <span className="num">0{i + 1}</span>
                  </span>
                  <p className="mt-5 text-xl font-semibold">{title}</p>
                  <p className="mt-2 text-[15px] leading-6 text-white/70">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Lapor & bantu */}
        <section className="mx-auto grid max-w-[1200px] gap-3 px-4 pt-24 sm:px-6 md:grid-cols-2" aria-label={t('Report and help', 'Lapor dan bantu')}>
          <Link href="/lapor" className="glass group flex flex-col rounded-[24px] p-6 hover:bg-white/10">
            <span className="grad-fire grid size-12 place-items-center rounded-full">
              <IconAlert size={22} />
            </span>
            <h2 className="mt-5 text-2xl font-bold text-ink">{t('See a fire? Report it with a photo.', 'Melihat api? Laporkan dengan foto.')}</h2>
            <p className="mt-2 leading-7 text-ink-2">
              {t(
                'Satellites miss small fires and fires under smoke. Every report needs a photo and is matched against satellite hotspots before it counts.',
                'Satelit melewatkan api kecil dan api di bawah asap. Setiap laporan wajib foto dan dicocokkan dengan titik panas satelit sebelum dihitung.',
              )}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 font-semibold text-[#ff9a5c]">
              {t('Report a fire', 'Lapor api')} <IconArrowRight size={16} />
            </span>
          </Link>
          <Link href="/bantu" className="glass group flex flex-col rounded-[24px] p-6 hover:bg-white/10">
            <span className="grad-sun grid size-12 place-items-center rounded-full">
              <IconHand size={22} />
            </span>
            <h2 className="mt-5 text-2xl font-bold text-ink">{t('Send what the posts actually need.', 'Kirim yang benar-benar dibutuhkan posko.')}</h2>
            <p className="mt-2 leading-7 text-ink-2">
              {t(
                'Masks, water, food, first-aid kits, pumps and tents. Each post shows how much is already pledged, so help goes where it is short.',
                'Masker, air, makanan, P3K, pompa, dan tenda. Tiap posko menampilkan berapa yang sudah dijanjikan, jadi bantuan masuk ke yang masih kurang.',
              )}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 font-semibold text-sun">
              {t('Give help', 'Bantu')} <IconArrowRight size={16} />
            </span>
          </Link>
        </section>

        {/* Data & batasan */}
        <section id="data" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 py-24 sm:px-6" aria-labelledby="data-h">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div>
              <p className="text-sm font-semibold text-leaf">{t('Data and limits', 'Data dan batasan')}</p>
              <h2 id="data-h" className="mt-2 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
                {t('Open sources. Limits written down.', 'Sumbernya terbuka. Batasnya kami tulis.')}
              </h2>
              <p className="mt-4 text-lg leading-8 text-ink-2">
                {t(
                  'This supports decisions; it does not replace people on the ground. The model has not been calibrated against historical fires, so arrival times are rough estimates.',
                  'Ini alat bantu keputusan, bukan pengganti orang di lapangan. Koefisien model belum dikalibrasi dengan catatan kebakaran historis, jadi angka jam tiba dibaca sebagai perkiraan kasar.',
                )}
              </p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {data.map(([k, v]) => (
                <div key={k} className="glass rounded-[16px] p-4">
                  <dt className="font-semibold text-ink">{k}</dt>
                  <dd className="mt-1 leading-7 text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Penutup */}
        <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6">
          <div className="grad-sun flex flex-col items-start justify-between gap-8 rounded-[28px] px-6 py-12 sm:px-12 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#1a1300] sm:text-4xl">
                {t('Try it with today’s hotspots.', 'Coba dengan titik panas hari ini.')}
              </h2>
              <p className="mt-2 max-w-[480px] text-lg leading-7 text-[#1a1300]/75">
                {t('No sign-in. Results can be printed for the command post.', 'Tanpa login. Hasilnya bisa dicetak untuk rapat posko.')}
              </p>
            </div>
            <ButtonLink href="/peta" size="lg" className="!bg-none !bg-[#0b1d15] !text-white hover:!bg-[#12341f]">
              {t('Open the map', 'Buka peta')} <IconArrowRight size={18} />
            </ButtonLink>
          </div>
        </section>
        <SiteFooter />
      </div>
    </div>
  );
}
