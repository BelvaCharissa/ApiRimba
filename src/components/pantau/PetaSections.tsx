'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import ReportList, { type PublicReport } from '@/components/lapor/ReportList';
import { IconAlert, IconArrowRight, IconHand, IconPin } from '@/components/ui/icons';
import { type AidTotalsRow, type AidType, type Campaign, campaignPercent } from '@/lib/aid';
import { fmtTimeWIB, nf } from '@/lib/format';
import { agoText, type Incident, incidentPriority, type NatHotspot } from '@/lib/pantau';
import { frpText } from './DetailCard';

const HOUR = 3600_000;

function simHref(i: Incident, members: NatHotspot[]) {
  const km = (h: NatHotspot) => Math.hypot((h.lon - i.lon) * 111 * Math.cos((i.lat * Math.PI) / 180), (h.lat - i.lat) * 111);
  const ign = members
    .filter((h) => km(h) <= 6)
    .sort((a, b) => km(a) - km(b))
    .slice(0, 12)
    .map((h) => `${h.lon.toFixed(5)},${h.lat.toFixed(5)}`);
  return `/peta?lokasi=${i.lat.toFixed(5)},${i.lon.toFixed(5)}&api=${(ign.length ? ign : [`${i.lon.toFixed(5)},${i.lat.toFixed(5)}`]).join(';')}&prov=${encodeURIComponent(i.province)}`;
}

function level(p: number) {
  if (p >= 75) return { cls: 'grad-fire', en: 'Act now', id: 'Tangani sekarang' };
  if (p >= 55) return { cls: 'bg-[#f07c32]/25 text-[#ffab70]', en: 'High', id: 'Tinggi' };
  if (p >= 35) return { cls: 'bg-sun/15 text-sun', en: 'Medium', id: 'Sedang' };
  return { cls: 'bg-white/10 text-ink-2', en: 'Low', id: 'Rendah' };
}

/**
 * Isi halaman Peta di bawah peta: panduan singkat, kejadian yang harus diprioritaskan (rinci),
 * laporan warga, dan posko bantuan. Klik "Lihat di peta" menggulir ke atas dan memilih kejadian.
 */
export default function PetaSections({
  incidents,
  visible,
  now,
  onShow,
  reports,
}: {
  incidents: Incident[];
  visible: NatHotspot[];
  now: number;
  onShow: (id: number) => void;
  reports: PublicReport[] | null;
}) {
  const t = useT();
  const [aid, setAid] = useState<{ campaigns: Campaign[]; totals: AidTotalsRow[] } | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/bantu')
      .then((r) => r.json() as Promise<{ campaigns: Campaign[]; totals: AidTotalsRow[] }>)
      .then(setAid)
      .catch(() => setAid({ campaigns: [], totals: [] }));
  }, []);

  const ranked = [...incidents].sort((a, b) => incidentPriority(b, now) - incidentPriority(a, now));
  const list = ranked.slice(0, showAll ? 30 : 8);
  const urgent = ranked.filter((i) => incidentPriority(i, now) >= 75).length;

  const pledged = new Map<string, Partial<Record<AidType, number>>>();
  for (const r of aid?.totals ?? []) {
    const v = pledged.get(r.campaign_key) ?? {};
    v[r.aid_type] = (v[r.aid_type] ?? 0) + Number(r.quantity);
    pledged.set(r.campaign_key, v);
  }

  const guide = [
    [t('Hotspots', 'Titik panas'), t('Dots from NASA satellites. Red = seen in the last 6 h, orange = today, yellow = older. Bigger = stronger fire.', 'Titik dari satelit NASA. Merah = 6 jam terakhir, oranye = hari ini, kuning = lebih lama. Makin besar = api makin kuat.')],
    [t('Incidents', 'Kejadian'), t('Hotspots within 2 km are grouped into one fire and scored 0-100 for priority.', 'Titik panas dalam 2 km digabung jadi satu kebakaran dan diberi skor prioritas 0-100.')],
    [t('Click a hotspot', 'Klik titik panas'), t('See wind, air quality, nearest water sources, services to call, and emergency numbers.', 'Lihat angin, kualitas udara, sumber air terdekat, layanan yang bisa dihubungi, dan nomor darurat.')],
    [t('Simulate', 'Simulasikan'), t('Run a 12-hour spread forecast at that spot: village arrival times and firebreak locations.', 'Jalankan prakiraan sebaran 12 jam di titik itu: jam tiba di desa dan lokasi sekat bakar.')],
    [t('Citizen reports', 'Laporan warga'), t('Yellow dots are photo reports from people on the ground, checked against satellites.', 'Titik kuning adalah laporan berfoto dari warga, dicocokkan dengan satelit.')],
    [t('Layers', 'Lapisan'), t('Switch on wind, air quality (PM2.5) or today’s satellite image from the Layers button.', 'Nyalakan angin, kualitas udara (PM2,5), atau citra satelit harian lewat tombol Lapisan.')],
  ];

  return (
    <div className="grad-canopy-soft">
      {/* aksi cepat */}
      <section className="mx-auto grid max-w-[1200px] gap-3 px-4 pt-12 sm:px-6 md:grid-cols-3">
        {[
          { href: '#prioritas', icon: <IconPin size={20} />, title: t('Priority incidents', 'Kejadian prioritas'), body: t(`${urgent} need action now`, `${urgent} perlu ditangani sekarang`), cls: 'grad-sun' },
          { href: '/lapor', icon: <IconAlert size={20} />, title: t('Report a fire', 'Lapor api'), body: t('Send a photo from the field', 'Kirim foto dari lapangan'), cls: 'grad-fire' },
          { href: '/bantu', icon: <IconHand size={20} />, title: t('Give help', 'Bantu'), body: t('Masks, water, food, pumps', 'Masker, air, makanan, pompa'), cls: 'bg-white text-[#0b1d15]' },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="glass group flex items-center gap-4 rounded-[20px] p-4 hover:bg-white/10">
            <span className={`grid size-12 shrink-0 place-items-center rounded-full ${a.cls}`}>{a.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{a.title}</span>
              <span className="block text-sm text-ink-3">{a.body}</span>
            </span>
            <IconArrowRight size={18} className="text-ink-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </section>

      {/* kejadian prioritas */}
      <section id="prioritas" className="mx-auto max-w-[1200px] scroll-mt-4 px-4 pt-16 sm:px-6" aria-labelledby="prioritas-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="prioritas-h" className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {t('What to handle first', 'Yang harus ditangani dulu')}
            </h2>
            <p className="mt-1 max-w-[640px] text-sm leading-6 text-ink-3">
              {t(
                'Score = number of hotspots (35%), how recent (30%), fire strength (25%) and satellite confidence (10%). It ranks where to look first; it does not replace a field check.',
                'Skor = jumlah titik panas (35%), seberapa baru (30%), kekuatan api (25%), dan keyakinan satelit (10%). Skor ini mengurutkan mana yang dilihat dulu; bukan pengganti pengecekan lapangan.',
              )}
            </p>
          </div>
        </div>

        {ranked.length === 0 ? (
          <p className="glass mt-6 rounded-[16px] p-5 text-ink-2">{t('No incidents in the selected time window.', 'Tidak ada kejadian pada rentang waktu ini.')}</p>
        ) : (
          <ol className="mt-6 space-y-2">
            {list.map((i, k) => {
              const p = incidentPriority(i, now);
              const lv = level(p);
              const members = visible.filter((h) => h.incident === i.id);
              const fresh = now - Date.parse(i.firstSeen) < 12 * HOUR;
              return (
                <li key={i.id} className="glass grid gap-4 rounded-[20px] p-4 md:grid-cols-[56px_1.4fr_1fr_auto] md:items-center">
                  <div className="flex items-center gap-3 md:block">
                    <span className="num block text-3xl font-bold text-ink">{k + 1}</span>
                    <span className="num text-xs text-ink-3 md:block">{p}/100</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${lv.cls}`}>{t(lv.en, lv.id)}</span>
                      {fresh && <span className="rounded-full bg-[#b3261e] px-2.5 py-0.5 text-[11px] font-bold text-white">{t('New', 'Baru')}</span>}
                      <p className="text-lg font-semibold text-ink">{i.province}</p>
                    </div>
                    <p className="num mt-1 text-sm text-ink-2">
                      {i.count} {t('hotspots', 'titik panas')} · {t('radius', 'radius')} {nf(Math.max(0.5, i.spreadKm))} km · {t('fire', 'api')} {frpText(i.maxFrp)} ({nf(i.maxFrp)} MW)
                    </p>
                    <p className="num text-xs text-ink-3">
                      {t('Last seen', 'Terakhir terlihat')} {agoText(now - Date.parse(i.lastSeen))} · {t('first', 'pertama')} {fmtTimeWIB(i.firstSeen)} · {i.lat.toFixed(3)}, {i.lon.toFixed(3)}
                    </p>
                  </div>
                  <div aria-hidden="true">
                    <span className="block h-2 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-[linear-gradient(90deg,#9be15d,#ffd24a_55%,#ff7a2f)]" style={{ width: `${p}%` }} />
                    </span>
                    <span className="num mt-1 block text-[11px] text-ink-3">
                      {t('high confidence', 'keyakinan tinggi')} {i.high}/{i.count}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onShow(i.id)} className="rounded-full border border-line-strong px-3.5 py-2 text-sm font-semibold text-ink hover:bg-white/10">
                      {t('Show on map', 'Lihat di peta')}
                    </button>
                    <Link href={simHref(i, members)} className="grad-sun rounded-full px-3.5 py-2 text-sm font-bold hover:brightness-105">
                      {t('Simulate', 'Simulasikan')}
                    </Link>
                    <Link href={`/bantu?prov=${encodeURIComponent(i.province)}`} className="rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-[#0b1d15] hover:bg-[#eef6e4]">
                      {t('Send help', 'Kirim bantuan')}
                    </Link>
                    <Link href={`/lapor?lokasi=${i.lat.toFixed(5)},${i.lon.toFixed(5)}`} className="grad-fire rounded-full px-3.5 py-2 text-sm font-bold hover:brightness-110">
                      {t('Report', 'Lapor')}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {ranked.length > 8 && (
          <button onClick={() => setShowAll(!showAll)} className="mt-3 text-sm font-semibold text-sun hover:underline">
            {showAll ? t('Show fewer', 'Tampilkan lebih sedikit') : t(`Show ${Math.min(30, ranked.length)} incidents`, `Tampilkan ${Math.min(30, ranked.length)} kejadian`)}
          </button>
        )}
      </section>

      {/* panduan */}
      <section className="mx-auto max-w-[1200px] px-4 pt-16 sm:px-6" aria-labelledby="panduan">
        <h2 id="panduan" className="text-3xl font-bold tracking-tight text-ink">
          {t('What is on this map', 'Isi peta ini')}
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guide.map(([k, v], i) => (
            <li key={k} className="glass rounded-[18px] p-4">
              <span className="grad-sun num grid size-8 place-items-center rounded-full text-sm font-bold">{i + 1}</span>
              <p className="mt-3 font-semibold text-ink">{k}</p>
              <p className="mt-1 text-sm leading-6 text-ink-2">{v}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* laporan warga */}
      <section className="mx-auto max-w-[1200px] px-4 pt-16 sm:px-6" aria-labelledby="warga">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="warga" className="text-3xl font-bold tracking-tight text-ink">
            {t('From people on the ground', 'Dari warga di lapangan')}
          </h2>
          <Link href="/lapor" className="grad-fire inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold hover:brightness-110">
            <IconAlert size={16} /> {t('Report a fire', 'Lapor api')}
          </Link>
        </div>
        <div className="mt-5">{reports ? <ReportList reports={reports.slice(0, 6)} compact /> : <div className="skeleton h-40 rounded-[20px]" />}</div>
      </section>

      {/* bantuan */}
      <section className="mx-auto max-w-[1200px] px-4 pb-20 pt-16 sm:px-6" aria-labelledby="bantu-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="bantu-h" className="text-3xl font-bold tracking-tight text-ink">
            {t('Posts that need help', 'Posko yang butuh bantuan')}
          </h2>
          <Link href="/bantu" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0b1d15] hover:bg-[#eef6e4]">
            {t('All posts', 'Semua posko')} <IconArrowRight size={16} />
          </Link>
        </div>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {(aid?.campaigns ?? []).slice(0, 3).map((c) => {
            const pct = campaignPercent(c, pledged.get(c.key) ?? {});
            return (
              <li key={c.key} className="glass rounded-[20px] p-5">
                <p className="text-lg font-semibold text-ink">
                  {t('BPBD post', 'Posko BPBD')} {c.province}
                </p>
                <p className="num text-sm text-ink-3">
                  {c.hotspots} {t('hotspots', 'titik panas')} · {t('priority', 'prioritas')} {c.topPriority}
                </p>
                <div className="mt-4 flex items-end justify-between">
                  <span className="num text-3xl font-bold text-ink">{pct}%</span>
                  <span className="text-xs text-ink-3">{t('of needs pledged', 'kebutuhan dijanjikan')}</span>
                </div>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-[linear-gradient(90deg,#9be15d,#ffd24a)]" style={{ width: `${Math.max(2, pct)}%` }} />
                </span>
                <Link href={`/bantu?prov=${encodeURIComponent(c.province)}`} className="grad-sun mt-4 inline-flex rounded-full px-4 py-2 text-sm font-bold hover:brightness-105">
                  {t('Pledge help', 'Janjikan bantuan')}
                </Link>
              </li>
            );
          })}
          {!aid && [0, 1, 2].map((i) => <li key={i} className="skeleton h-44 rounded-[20px]" />)}
        </ul>
      </section>
    </div>
  );
}

