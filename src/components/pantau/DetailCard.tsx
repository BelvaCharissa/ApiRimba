'use client';

import { type ReactNode, useState } from 'react';
import { IconClose } from '@/components/ui/icons';
import { ButtonLink } from '@/components/ui/primitives';
import { fmtTimeWIB, nf } from '@/lib/format';
import {
  agoText,
  type CityAir,
  compassId,
  type Incident,
  incidentPriority,
  ispuOf,
  type NatHotspot,
  type WindGrid,
  windAt,
} from '@/lib/pantau';

const CONF_TEXT: Record<NatHotspot['confidence'], [string, string]> = {
  high: ['Tinggi', 'hampir pasti api'],
  nominal: ['Sedang', 'kemungkinan besar api'],
  low: ['Rendah', 'perlu dicek di lapangan'],
};

export function frpText(frp: number): string {
  if (frp >= 30) return 'sangat kuat';
  if (frp >= 10) return 'kuat';
  if (frp >= 3) return 'sedang';
  return 'lemah';
}

function km(a: [number, number], b: [number, number]) {
  return Math.hypot((b[0] - a[0]) * 111 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 111);
}

function bearing(a: [number, number], b: [number, number]) {
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
  return ((Math.atan2(dx, b[1] - a[1]) * 180) / Math.PI + 360) % 360;
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5">
      <dt className="w-[108px] shrink-0 text-ink-3">{k}</dt>
      <dd className="min-w-0 flex-1 font-medium text-ink">{children}</dd>
    </div>
  );
}

function WindRow({ wind, lon, lat }: { wind: WindGrid | null; lon: number; lat: number }) {
  const v = wind ? windAt(wind, lon, lat) : null;
  if (!v) return null;
  const sp = Math.hypot(v.u, v.v);
  const to = (Math.atan2(v.u, v.v) * 180) / Math.PI;
  return (
    <Row k="Angin sekarang">
      <span className="num">{nf(sp)} m/s</span> bertiup ke {compassId(to)}
      <span className="block text-[13px] font-normal leading-5 text-ink-2">
        Asap dan api cenderung bergerak ke arah {compassId(to)}
        {sp < 2 ? ', tetapi angin lemah sehingga sebaran lambat.' : sp > 6 ? '; angin kencang mempercepat sebaran.' : '.'}
      </span>
    </Row>
  );
}

function AirRow({ air, lon, lat }: { air: CityAir[]; lon: number; lat: number }) {
  const near = [...air].sort((a, b) => km([lon, lat], [a.lon, a.lat]) - km([lon, lat], [b.lon, b.lat]))[0];
  if (!near) return null;
  const cat = ispuOf(near.pm25);
  return (
    <Row k="Udara terdekat">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ background: cat.color }} />
        {cat.label}
      </span>{' '}
      di {near.city} <span className="num font-normal text-ink-2">({nf(km([lon, lat], [near.lon, near.lat]), 0)} km, PM2,5 {nf(near.pm25)} µg/m³)</span>
    </Row>
  );
}

/** Tombol simulasi: area 16 x 16 km dibangun dari data nyata di sekitar titik ini. */
function SimCta({ lon, lat, province, members }: { lon: number; lat: number; province: string; members: NatHotspot[] }) {
  // Titik awal api = titik panas kejadian yang paling dekat ke pusat (maks 12, dalam 6 km).
  const ign = [...members]
    .filter((h) => km([lon, lat], [h.lon, h.lat]) <= 6)
    .sort((a, b) => km([lon, lat], [a.lon, a.lat]) - km([lon, lat], [b.lon, b.lat]))
    .slice(0, 12)
    .map((h) => `${h.lon.toFixed(5)},${h.lat.toFixed(5)}`);
  const q = `lokasi=${lat.toFixed(5)},${lon.toFixed(5)}&api=${(ign.length ? ign : [`${lon.toFixed(5)},${lat.toFixed(5)}`]).join(';')}&prov=${encodeURIComponent(province)}`;
  return (
    <div className="grid gap-2">
      <ButtonLink href={`/peta?${q}`}>Simulasikan sebaran 12 jam di sini</ButtonLink>
      <ButtonLink href={`/peta?${q}&tab=respons`} variant="secondary">
        Susun rencana respons
      </ButtonLink>
      <p className="text-xs leading-5 text-ink-3">Area 16 x 16 km dibangun dari citra tutupan lahan, elevasi, desa, dan cuaca langsung di lokasi ini.</p>
    </div>
  );
}

function CopyCoord({ lon, lat }: { lon: number; lat: number }) {
  const [ok, setOk] = useState(false);
  const txt = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(txt);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          setOk(false);
        }
      }}
      className="num rounded-[6px] bg-sunken px-2 py-1 font-mono text-[12px] text-ink hover:bg-line"
      aria-label={`Salin koordinat ${txt}`}
    >
      {ok ? 'Tersalin' : txt}
    </button>
  );
}

function Shell({ eyebrow, title, onClose, children }: { eyebrow: string; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-[20px] border border-line bg-card shadow-float">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{eyebrow}</p>
          <h2 className="mt-0.5 text-[17px] font-bold leading-snug text-ink">{title}</h2>
        </div>
        <button onClick={onClose} aria-label="Tutup detail" className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink">
          <IconClose size={18} />
        </button>
      </header>
      <div className="max-h-[min(60dvh,560px)] overflow-y-auto px-4 py-3">{children}</div>
    </section>
  );
}

export function HotspotDetail({
  h,
  inc,
  now,
  wind,
  air,
  members,
  onClose,
  onIncident,
}: {
  h: NatHotspot;
  members: NatHotspot[];
  inc: Incident | undefined;
  now: number;
  wind: WindGrid | null;
  air: CityAir[];
  onClose: () => void;
  onIncident: (id: number) => void;
}) {
  const [c, cText] = CONF_TEXT[h.confidence];
  return (
    <Shell eyebrow="Titik panas satelit" title={`${h.province}, ${agoText(now - Date.parse(h.acquiredAt))}`} onClose={onClose}>
      <dl className="divide-y divide-line text-sm">
        <Row k="Terdeteksi">{fmtTimeWIB(h.acquiredAt)}</Row>
        <Row k="Satelit">{h.satellite}</Row>
        <Row k="Keyakinan">
          {c} <span className="font-normal text-ink-2">({cText})</span>
        </Row>
        <Row k="Kekuatan api">
          <span className="num">{nf(h.frp)} MW</span> <span className="font-normal text-ink-2">({frpText(h.frp)})</span>
        </Row>
        <Row k="Koordinat">
          <CopyCoord lon={h.lon} lat={h.lat} />
        </Row>
        <WindRow wind={wind} lon={h.lon} lat={h.lat} />
        <AirRow air={air} lon={h.lon} lat={h.lat} />
      </dl>
      {inc && inc.count > 1 && (
        <button onClick={() => onIncident(inc.id)} className="mt-2 w-full rounded-[12px] bg-sunken px-3 py-2.5 text-left text-sm hover:bg-line">
          Bagian dari kejadian <b>{inc.count} titik</b> dalam radius {nf(Math.max(0.5, inc.spreadKm))} km. <span className="font-semibold text-wind">Lihat kejadian</span>
        </button>
      )}
      <div className="mt-4">
        <SimCta lon={h.lon} lat={h.lat} province={h.province} members={members.length ? members : [h]} />
      </div>
    </Shell>
  );
}

export function IncidentDetail({
  inc,
  now,
  wind,
  air,
  members,
  onClose,
}: {
  inc: Incident;
  members: NatHotspot[];
  now: number;
  wind: WindGrid | null;
  air: CityAir[];
  onClose: () => void;
}) {
  const activeH = (Date.parse(inc.lastSeen) - Date.parse(inc.firstSeen)) / 3600_000;
  const prio = incidentPriority(inc, now);
  return (
    <Shell eyebrow={`Kejadian · prioritas ${prio}/100`} title={`${inc.count} titik panas di ${inc.province}`} onClose={onClose}>
      <dl className="divide-y divide-line text-sm">
        <Row k="Pertama terlihat">
          {fmtTimeWIB(inc.firstSeen)} <span className="font-normal text-ink-2">({agoText(now - Date.parse(inc.firstSeen))})</span>
        </Row>
        <Row k="Terakhir terlihat">
          {fmtTimeWIB(inc.lastSeen)} <span className="font-normal text-ink-2">({agoText(now - Date.parse(inc.lastSeen))})</span>
        </Row>
        <Row k="Lama aktif">{activeH < 1 ? 'satu lintasan satelit' : `±${nf(activeH, 0)} jam`}</Row>
        <Row k="Sebaran">
          radius <span className="num">{nf(Math.max(0.5, inc.spreadKm))} km</span>
        </Row>
        <Row k="Kekuatan api">
          maks <span className="num">{nf(inc.maxFrp)} MW</span> <span className="font-normal text-ink-2">({frpText(inc.maxFrp)})</span>, total{' '}
          <span className="num">{nf(inc.sumFrp, 0)} MW</span>
        </Row>
        <Row k="Keyakinan tinggi">
          <span className="num">
            {inc.high} dari {inc.count}
          </span>
        </Row>
        <Row k="Pusat">
          <CopyCoord lon={inc.lon} lat={inc.lat} />
        </Row>
        <WindRow wind={wind} lon={inc.lon} lat={inc.lat} />
        <AirRow air={air} lon={inc.lon} lat={inc.lat} />
      </dl>
      <p className="mt-2 rounded-[12px] bg-sunken px-3 py-2 text-[13px] leading-5 text-ink-2">
        Prioritas dihitung dari jumlah titik, kekuatan api, seberapa baru, dan keyakinan satelit. Makin tinggi, makin perlu dicek lebih dulu.
      </p>
      <div className="mt-4">
        <SimCta lon={inc.lon} lat={inc.lat} province={inc.province} members={members} />
      </div>
    </Shell>
  );
}

export function CityDetail({ c, hot, onClose }: { c: CityAir; hot: NatHotspot[]; onClose: () => void }) {
  const cat = ispuOf(c.pm25);
  const near = hot.filter((h) => km([c.lon, c.lat], [h.lon, h.lat]) <= 50);
  const nearest = [...hot].sort((a, b) => km([c.lon, c.lat], [a.lon, a.lat]) - km([c.lon, c.lat], [b.lon, b.lat]))[0];
  return (
    <Shell eyebrow="Kualitas udara (perkiraan per jam)" title={`${c.city}, ${c.province}`} onClose={onClose}>
      <div className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: `${cat.color}1f` }}>
        <span className="grid size-14 shrink-0 place-items-center rounded-full text-lg font-bold" style={{ background: cat.color, color: cat.key === 'tidak_sehat' ? '#111a15' : '#fff' }}>
          {Math.round(c.pm25)}
        </span>
        <div>
          <p className="text-base font-bold" style={{ color: cat.ink }}>
            {cat.label}
          </p>
          <p className="text-sm leading-5 text-ink-2">{cat.advice}</p>
        </div>
      </div>
      <dl className="mt-2 divide-y divide-line text-sm">
        <Row k="PM2,5">
          <span className="num">{nf(c.pm25)} µg/m³</span>
        </Row>
        <Row k="Titik panas ≤ 50 km">
          <span className="num">{near.length}</span>
        </Row>
        {nearest && (
          <Row k="Api terdekat">
            <span className="num">{nf(km([c.lon, c.lat], [nearest.lon, nearest.lat]), 0)} km</span> di {compassId(bearing([c.lon, c.lat], [nearest.lon, nearest.lat]))}
          </Row>
        )}
      </dl>
      <p className="mt-2 text-xs leading-5 text-ink-3">
        Kategori memakai batas ISPU PM2,5 (Permen LHK P.14/2020). Nilai berasal dari model Open-Meteo/CAMS, bukan stasiun ukur; ISPU resmi memakai
        rata-rata 24 jam.
      </p>
    </Shell>
  );
}

export function ProvinceDetail({
  name,
  hot,
  incidents,
  air,
  now,
  onClose,
  onIncident,
}: {
  name: string;
  hot: NatHotspot[];
  incidents: Incident[];
  air: CityAir[];
  now: number;
  onClose: () => void;
  onIncident: (id: number) => void;
}) {
  const mine = hot.filter((h) => h.province === name);
  const incs = incidents.filter((i) => i.province === name).sort((a, b) => incidentPriority(b, now) - incidentPriority(a, now));
  const high = mine.filter((h) => h.confidence === 'high').length;
  const cities = air.filter((c) => c.province === name);
  return (
    <Shell eyebrow="Provinsi" title={name} onClose={onClose}>
      <dl className="num grid grid-cols-3 gap-2 text-center">
        {[
          ['Titik panas', mine.length],
          ['Kejadian', incs.length],
          ['Yakin tinggi', high],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[12px] bg-sunken px-2 py-2.5">
            <dt className="text-xs text-ink-3">{k}</dt>
            <dd className="text-xl font-bold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {cities.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {cities.map((c) => {
            const cat = ispuOf(c.pm25);
            return (
              <li key={c.city} className="flex items-center justify-between gap-2">
                <span>Udara {c.city}</span>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: cat.color }} />
                  {cat.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {incs.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-4 text-sm font-semibold text-ink">Kejadian prioritas</h3>
          <ul className="space-y-1.5">
            {incs.slice(0, 6).map((i) => (
              <li key={i.id}>
                <button onClick={() => onIncident(i.id)} className="w-full rounded-[12px] bg-sunken px-3 py-2 text-left text-sm hover:bg-line">
                  <span className="font-semibold">{i.count} titik</span> · FRP maks {nf(i.maxFrp)} MW
                  <span className="block text-xs text-ink-3">terakhir {agoText(now - Date.parse(i.lastSeen))}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
  );
}
