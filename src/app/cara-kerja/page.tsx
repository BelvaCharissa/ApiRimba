import type { Metadata } from 'next';
import { IconArrowRight } from '@/components/ui/icons';
import { ButtonLink } from '@/components/ui/primitives';
import SiteFooter from '@/components/ui/SiteFooter';
import SiteHeader from '@/components/ui/SiteHeader';
import { getLang, getT } from '@/lib/i18n-server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === 'id' ? 'Cara kerja' : 'How it works' };
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="glass grid gap-4 rounded-[24px] p-6 md:grid-cols-[240px_1fr] md:gap-10 md:p-8">
      <h2 id={`${id}-h`} className="text-2xl font-bold leading-tight tracking-tight text-ink">
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

export default async function CaraKerjaPage() {
  const t = await getT();
  const flow = [
    [t('Pick the conditions', 'Pilih kondisi'), t('Area, ignition point (default or tap the map), wind speed and direction, and how dry the land is. Or one tap on "Use current weather".', 'Wilayah, titik awal api (bawaan atau klik sendiri di peta), kecepatan dan arah angin, serta kekeringan lahan. Bisa juga satu klik "Pakai cuaca sekarang".')],
    [t('Watch 12 hours of spread', 'Lihat sebaran 12 jam'), t('The map plays the fire every 15 minutes. Drag the time bar to jump to any hour.', 'Peta memutar perkembangan api tiap 15 menit. Geser bilah waktu untuk melompat ke jam mana pun.')],
    [t('Find firebreaks', 'Cari sekat bakar'), t('The app tests 225 firebreak lines and returns the three best, with the coordinates of both ends.', 'Sistem menguji 225 garis sekat dan memberi tiga lokasi terbaik lengkap dengan koordinat ujung-ujungnya.')],
    [t('Briefing and report', 'Briefing dan laporan'), t('Gemini writes the actions for the command post; the result is saved as a report you can print and share.', 'Gemini menyusun tindakan untuk posko; hasil disimpan sebagai laporan yang bisa dicetak dan dibagikan.')],
  ];

  return (
    <div className="min-h-dvh bg-paper">
      <div className="grad-canopy">
        <SiteHeader />
        <header className="mx-auto max-w-[1200px] px-4 pb-14 pt-10 sm:px-6">
          <p className="text-sm font-semibold text-leaf">{t('How it works', 'Cara kerja')}</p>
          <h1 className="mt-2 max-w-[820px] text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {t('From a hotspot to a firebreak plan, in four steps.', 'Dari titik api ke rencana sekat bakar, dalam empat langkah.')}
          </h1>
          <p className="mt-4 max-w-[680px] text-lg leading-8 text-ink-2">
            {t(
              'ApiRimba simulates 12 hours of peat fire spread in your browser, then uses the same simulation to find where a firebreak helps most.',
              'ApiRimba mensimulasikan sebaran kebakaran lahan gambut 12 jam ke depan langsung di browser, lalu memakai simulasi yang sama untuk mencari lokasi sekat bakar terbaik.',
            )}
          </p>
          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {flow.map(([k, v], i) => (
              <li key={k} className="glass rounded-[20px] p-5">
                <span className="num grad-sun grid size-9 place-items-center rounded-full text-sm font-bold">0{i + 1}</span>
                <p className="mt-4 font-semibold text-ink">{k}</p>
                <p className="mt-1 text-sm leading-6 text-ink-2">{v}</p>
              </li>
            ))}
          </ol>
        </header>
      </div>

      <div className="grad-canopy-soft">
        <main className="mx-auto max-w-[1200px] space-y-3 px-4 py-14 sm:px-6">
          <Section id="sebaran" title={t('Spread simulation', 'Simulasi sebaran')}>
            <p>
              {t(
                'A 16 x 16 km area is split into 4,096 cells of 250 m. Every 15 minutes a burning cell can ignite its 8 neighbours. The chance goes up downwind, uphill, in dry fuel, and on peat.',
                'Area 16 x 16 km dibagi menjadi 4.096 sel berukuran 250 m. Setiap 15 menit, sel yang terbakar dapat menyalakan 8 sel tetangganya. Peluangnya naik bila searah angin, menanjak, bahan bakarnya kering, atau berupa gambut.',
              )}
            </p>
            <p>
              {t(
                'The simulation runs 12 times with random variation. That gives a burn probability for each cell and an estimated fire arrival time for each village. Fire outside the 16 x 16 km box is not counted; the edge is shown as a dashed line.',
                'Simulasi diulang 12 kali dengan variasi acak. Dari situ didapat peluang terbakar tiap sel dan perkiraan jam tiba api di tiap desa. Api di luar kotak 16 x 16 km tidak dihitung; batas ini ditandai garis putus-putus di peta.',
              )}
            </p>
          </Section>

          <Section id="warna" title={t('Reading the map colours', 'Membaca warna peta')}>
            <ul className="space-y-2">
              <Swatch color="#ffd43b" label={t('Flaming', 'Menyala')} desc={t('active surface fire, the fastest-moving part.', 'api aktif di permukaan, bergerak paling cepat.')} />
              <Swatch color="#c92a2a" label={t('Smouldering', 'Membara')} desc={t('peat burning slowly below the surface; can last for hours.', 'gambut yang terbakar lambat di bawah permukaan; bisa bertahan berjam-jam.')} />
              <Swatch color="#8a7570" label={t('Burnt', 'Bekas terbakar')} desc={t('the fire has gone out in this cell.', 'api sudah padam di sel ini.')} />
              <Swatch color="#9775fa" label={t('Purple', 'Ungu')} desc={t('chance of burning within 12 hours; darker = more certain.', 'peluang terbakar dalam 12 jam; makin pekat makin pasti.')} />
            </ul>
          </Section>

          <Section id="level" title={t('Village levels', 'Level desa')}>
            <p>{t('The level comes from the estimated fire arrival time around the village (about 500 m radius):', 'Level ditentukan dari perkiraan jam tiba api di sekitar desa (radius ±500 m):')}</p>
            <ul className="space-y-1">
              <li>
                <b className="text-danger-ink">{t('Danger', 'Awas')}</b>: {t('fire arrives in under 4 hours.', 'api tiba kurang dari 4 jam.')}
              </li>
              <li>
                <b className="text-alert-ink">{t('Alert', 'Siaga')}</b>: {t('fire arrives in 4 to 8 hours.', 'api tiba 4 sampai 8 jam.')}
              </li>
              <li>
                <b className="text-warn-ink">{t('Watch', 'Waspada')}</b>: {t('fire arrives after more than 8 hours.', 'api tiba lebih dari 8 jam.')}
              </li>
              <li>
                <b className="text-ok-ink">{t('Safe', 'Aman')}</b>: {t('not reached within 12 hours.', 'tidak terjangkau dalam 12 jam.')}
              </li>
            </ul>
            <p>{t('On the map, a house icon turns red only when the simulation time reaches the arrival time.', 'Di peta, ikon rumah baru berubah merah ketika waktu simulasi mencapai jam tiba api.')}</p>
          </Section>

          <Section id="sekat" title={t('Firebreaks and their score', 'Sekat bakar dan skornya')}>
            <p>
              {t(
                'A firebreak is a strip cleared of fuel (and wetted on peat) so the fire stops. The app draws 225 candidate lines ahead of the fire: 5 distances, 3 angles, 3 lengths and 5 offsets. Each line is simulated again, and the three best that are at least 1 km apart are kept.',
                'Sekat bakar adalah jalur yang dibersihkan dari bahan bakar (dan dibasahi di gambut) agar api berhenti. Sistem membuat 225 garis kandidat di depan arah sebaran api: 5 jarak dari titik api, 3 sudut, 3 panjang, dan 5 posisi geser. Setiap garis disimulasikan ulang, lalu dipilih tiga terbaik yang berjarak minimal 1 km satu sama lain.',
              )}
            </p>
            <p>
              <b className="text-ink">{t('Score 0 to 100', 'Skor 0 sampai 100')}</b> = 100 x {t('effectiveness', 'efektivitas')} x {t('time factor', 'faktor waktu')} − 1.5 x {t('length (km)', 'panjang (km)')}.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('Effectiveness: weighted risk reduction (settlements x100, plantations x10, peat x5, forest x3). A 35% drop counts as full.', 'Efektivitas: penurunan risiko berbobot (permukiman x100, kebun x10, gambut x5, hutan x3). Turun 35% dianggap penuh.')}</li>
              <li>{t('Time factor: time left after 4 hours of building. 3 hours or more left counts as full.', 'Faktor waktu: sisa waktu setelah 4 jam pembangunan. Sisa 3 jam atau lebih bernilai penuh.')}</li>
              <li>{t('A firebreak that cannot be built before the fire arrives is dropped.', 'Sekat yang tidak sempat dibangun sebelum api tiba langsung dibuang.')}</li>
            </ul>
            <p>{t('Each firebreak has start and end coordinates (e.g. A1 to A2) so the crew knows the exact line.', 'Setiap sekat diberi koordinat titik awal dan akhir (mis. A1 ke A2) agar tim lapangan tahu persis jalurnya.')}</p>
          </Section>

          <Section id="laporan" title={t('Citizen reports', 'Laporan warga')}>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('A photo is required. The file is checked to be a real image (JPEG, PNG or WebP, max 8 MB).', 'Foto wajib. File diperiksa harus gambar asli (JPEG, PNG, atau WebP, maks 8 MB).')}</li>
              <li>{t('If the photo has GPS, its distance to the marked location is measured.', 'Bila foto punya GPS, jaraknya ke lokasi yang ditandai diukur.')}</li>
              <li>{t('The nearest NASA FIRMS hotspot in the last 48 hours is looked up.', 'Titik panas NASA FIRMS terdekat dalam 48 jam terakhir dicari.')}</li>
              <li>{t('Within 5 km of either = "Matched with satellite". Otherwise "Waiting for review" until an officer checks it.', 'Dalam 5 km dari salah satunya = "Cocok dengan satelit". Selain itu "Menunggu tinjauan" sampai petugas memeriksa.')}</li>
            </ul>
          </Section>

          <Section id="bantu" title={t('Aid pledges', 'Komitmen bantuan')}>
            <p>
              {t(
                'Each province with at least 5 active hotspots gets a post. Needs are scaled from the hotspot count (for example 40 masks and 25 litres of water per hotspot), with a minimum per post. They are estimates, not official requests.',
                'Tiap provinsi dengan minimal 5 titik panas aktif punya satu posko. Kebutuhan diskalakan dari jumlah titik panas (misalnya 40 masker dan 25 liter air per titik), dengan batas minimum per posko. Ini perkiraan, bukan permintaan resmi.',
              )}
            </p>
            <p>{t('No money moves in the app. A pledge records what you will give and how it gets there.', 'Tidak ada uang yang berpindah di aplikasi. Janji mencatat apa yang akan diberi dan cara mengirimnya.')}</p>
          </Section>

          <Section id="ai" title={t('Where AI is used', 'Di mana AI dipakai')}>
            <p>
              <b className="text-ink">{t('Firebreak search', 'Pencarian sekat bakar')}</b>: {t('the simulation-based search above, running in your browser.', 'pencarian berbasis simulasi di atas, berjalan di browser Anda.')}
            </p>
            <p>
              <b className="text-ink">{t('Briefing', 'Briefing')}</b>:{' '}
              {t(
                'Google Gemini reads the simulation numbers (ignition coordinates, villages, arrival times, firebreak coordinates) and writes the priority actions for that place. It is told not to invent numbers. If it is unavailable, a rule-based briefing is used.',
                'Google Gemini membaca angka hasil simulasi (koordinat titik api, desa, jam tiba, koordinat sekat) dan menyusun prioritas tindakan untuk lokasi itu. Gemini dilarang mengarang angka. Bila layanan tidak tersedia, briefing disusun dengan aturan tetap.',
              )}
            </p>
            <p>
              <b className="text-ink">{t('Assistant', 'Asisten')}</b>:{' '}
              {t(
                'the "Ask AI" button answers questions using today’s hotspot summary. It does not dispatch crews or verify reports.',
                'tombol "Tanya AI" menjawab pertanyaan memakai ringkasan titik panas hari ini. Asisten tidak mengerahkan regu atau memverifikasi laporan.',
              )}
            </p>
          </Section>

          <Section id="data" title={t('Data and refresh', 'Data dan pembaruan')}>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('Hotspots: NASA FIRMS (VIIRS satellites), refetched at most every 30 minutes.', 'Titik panas: NASA FIRMS (satelit VIIRS), diambil ulang otomatis paling lama tiap 30 menit.')}</li>
              <li>{t('Weather: Open-Meteo (wind, humidity, 14 days of rain).', 'Cuaca: Open-Meteo (angin, kelembapan, hujan 14 hari).')}</li>
              <li>{t('Terrain: AWS Terrarium. Base maps: Esri imagery, CARTO and OpenStreetMap.', 'Relief: Terrarium AWS. Peta dasar: citra Esri, CARTO, dan OpenStreetMap.')}</li>
              <li>{t('If the internet or a data source fails, the app falls back to stored data.', 'Bila internet atau sumber data gagal, aplikasi otomatis memakai data cadangan yang tersimpan.')}</li>
            </ul>
          </Section>

          <Section id="batasan" title={t('Limits', 'Batasan')}>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('Model coefficients were tuned visually, not calibrated against historical fires.', 'Koefisien model ditala secara visual, belum dikalibrasi dengan kebakaran historis.')}</li>
              <li>{t('Land cover, peat and villages in the three sample scenarios are illustrative; village names are fictional.', 'Tutupan lahan, gambut, dan desa pada tiga skenario adalah ilustrasi; nama desa fiktif.')}</li>
              <li>{t('Wind is assumed constant for 12 hours.', 'Angin dianggap seragam selama 12 jam.')}</li>
            </ul>
            <p className="rounded-[12px] bg-black/25 p-4 text-ink">
              {t('Results are simulated forecasts to support decisions, not a replacement for judgement in the field.', 'Hasil adalah prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan.')}
            </p>
          </Section>

          <div className="pt-6">
            <ButtonLink href="/peta" size="lg">
              {t('Open the map', 'Buka peta')} <IconArrowRight size={18} />
            </ButtonLink>
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
