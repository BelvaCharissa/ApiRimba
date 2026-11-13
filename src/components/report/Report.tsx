'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowLeft, IconCheck, IconChevronLeft, IconChevronRight, IconLink, IconPrint } from '@/components/ui/icons';
import { LogoMark } from '@/components/ui/Logo';
import { Button, buttonClass } from '@/components/ui/primitives';
import { compass, LEVEL_COLOR, LEVEL_LABEL, nf } from '@/lib/format';
import { BREAK_COLORS_PRINT, BREAK_LABELS, decCoord, describeBreak, fmtCoord, type LonLat, orientation } from '@/lib/geo';
import { paintLand } from '@/lib/render';
import type { ScenarioData } from '@/lib/scenario';
import { expectedBurnedKm2, runMonteCarlo } from '@/lib/sim/engine';
import { lonLatToCell, rasterLine } from '@/lib/sim/grid';
import { buildSimInput } from '@/lib/sim/input';
import { DEFAULT_SEED, FIREBREAK_BUILD_HOURS, STEP_MINUTES } from '@/lib/sim/params';
import { villageRisks } from '@/lib/sim/risk';
import type { RiskLevel, VillageRisk } from '@/lib/sim/types';

interface SavedRec {
  rank: number;
  line: { coordinates: [number, number][] };
  widthM: number;
  lengthKm: number;
  score: number;
  reductionPct: number;
  marginHours: number;
  peatBypassRisk: boolean;
  note: string;
  applied: boolean;
}

interface SavedSimulation {
  id: string;
  createdAt: string;
  scenarioSlug: string;
  scenarioName: string;
  province: string;
  windMs: number;
  windFromDeg: number;
  seed?: number;
  steps: number;
  stepMinutes: number;
  ignitions?: { lon: number; lat: number }[];
  dataSource: string;
  summary: { burnedKm2By12h: number; burnedKm2WithFirebreak: number | null; dryness: number };
  arrivalB64: string;
  firebreakApplied: boolean;
  aiBriefing: string | null;
  recommendations: SavedRec[];
  villageRisks: { villageName: string; variant: string; etaHours: number | null; burnProbability: number; level: RiskLevel }[];
}

interface Variant {
  key: string;
  title: string;
  rec: SavedRec | null;
  prob: Float32Array;
  meanArrival: Float32Array;
  km2: number;
  risks: VillageRisk[];
}

/** Hitung ulang peta tiap varian (tanpa sekat, sekat A/B/C) dari parameter laporan. Deterministik (seed sama). */
function useVariants(sim: SavedSimulation | null, sc: ScenarioData | null) {
  return useMemo(() => {
    if (!sim || !sc) return null;
    const ignitions = (sim.ignitions ?? []).map((p) => lonLatToCell(sc.grid, p.lon, p.lat)).filter((c) => c >= 0);
    const base = { windMs: sim.windMs, windFromDeg: sim.windFromDeg, dryness: sim.summary.dryness, ignitions };
    const seed = sim.seed ?? DEFAULT_SEED;
    const run = (cells: number[]) => runMonteCarlo(buildSimInput(sc, { ...base, firebreakCells: cells }), seed, 12);
    const toCells = (r: SavedRec) => {
      const [a, b] = r.line.coordinates.map(([lon, lat]): [number, number] => [
        (lon - sc.grid.originLon) / sc.grid.cellDegLon,
        (sc.grid.originLat - lat) / sc.grid.cellDegLat,
      ]);
      return rasterLine(sc.grid, a, b, 2);
    };
    const make = (key: string, title: string, rec: SavedRec | null): Variant => {
      const mc = run(rec ? toCells(rec) : []);
      return {
        key,
        title,
        rec,
        prob: mc.prob,
        meanArrival: mc.meanArrival,
        km2: expectedBurnedKm2(mc.prob, sc.grid.cellSizeM),
        risks: villageRisks(sc.grid, sc.villages, mc.prob, mc.meanArrival, STEP_MINUTES),
      };
    };
    const ign: LonLat = ignitions.length
      ? (() => {
          const pts = sim.ignitions ?? [];
          return [pts.reduce((s, p) => s + p.lon, 0) / pts.length, pts.reduce((s, p) => s + p.lat, 0) / pts.length];
        })()
      : sc.center;
    return {
      ign,
      ignitions,
      variants: [make('base', 'Tanpa sekat', null), ...sim.recommendations.map((r) => make(`s${r.rank}`, `Sekat ${BREAK_LABELS[r.rank - 1]}`, r))],
    };
  }, [sim, sc]);
}

function ReportMap({ v, scenario, ign, windFromDeg }: { v: Variant; scenario: ScenarioData; ign: LonLat; windFromDeg: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { w, h } = scenario.grid;
    const scale = 10;
    c.width = w * scale;
    c.height = h * scale;
    const ctx = c.getContext('2d')!;
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d')!;
    const land = tctx.createImageData(w, h);
    paintLand(land, scenario.fuelClass);
    for (let i = 3; i < land.data.length; i += 4) land.data[i] = 150;
    tctx.putImageData(land, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, c.width, c.height);

    // area terbakar: peluang >= 25%, warna menurut jam tiba (awal = merah tua, akhir = oranye muda)
    const fire = tctx.createImageData(w, h);
    for (let i = 0; i < v.prob.length; i++) {
      if (v.prob[i] < 0.25) continue;
      const late = Math.min(1, Math.max(0, v.meanArrival[i] / 48));
      fire.data[i * 4] = 180 + late * 70;
      fire.data[i * 4 + 1] = 30 + late * 130;
      fire.data[i * 4 + 2] = 30 + late * 30;
      fire.data[i * 4 + 3] = 225;
    }
    tctx.putImageData(fire, 0, 0);
    ctx.drawImage(tmp, 0, 0, c.width, c.height);

    const toPx = (lon: number, lat: number): [number, number] => [
      ((lon - scenario.grid.originLon) / scenario.grid.cellDegLon) * scale,
      ((scenario.grid.originLat - lat) / scenario.grid.cellDegLat) * scale,
    ];
    const label = (text: string, x: number, y: number, color = '#111a15') => {
      ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
      // label yang melewati tepi kanan dipindah ke kiri titik
      const tw = ctx.measureText(text).width;
      if (x + tw > c.width - 6) x = x - tw - 30;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    // sekat (hanya sekat varian ini) dengan titik ujung A1 / A2
    if (v.rec) {
      const color = BREAK_COLORS_PRINT[v.rec.rank - 1];
      const L = BREAK_LABELS[v.rec.rank - 1];
      const [a, b] = v.rec.line.coordinates.map(([lon, lat]) => toPx(lon, lat));
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.stroke();
      [a, b].forEach((p, k) => {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        label(`${L}${k + 1}`, p[0] + 11, p[1] + (k === 0 ? -8 : 18), color);
      });
    }

    // titik api
    const [ix, iy] = toPx(ign[0], ign[1]);
    ctx.fillStyle = '#111a15';
    ctx.beginPath();
    ctx.arc(ix, iy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(ix, iy, 5, 0, Math.PI * 2);
    ctx.fill();
    label('Titik api', ix + 13, iy + 5);

    // desa: kotak berwarna level
    const risk = new Map(v.risks.map((r) => [r.villageName, r]));
    for (const vil of scenario.villages) {
      const [x, y] = toPx(vil.lon, vil.lat);
      const lv = risk.get(vil.name)?.level ?? 'aman';
      ctx.fillStyle = LEVEL_COLOR[lv];
      ctx.strokeStyle = '#111a15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x + 10, y - 2);
      ctx.lineTo(x + 10, y + 9);
      ctx.lineTo(x - 10, y + 9);
      ctx.lineTo(x - 10, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      label(vil.name, x + 15, y + 5);
    }

    // utara + angin
    const cx = c.width - 56;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fillRect(c.width - 112, 12, 100, 120);
    ctx.strokeStyle = '#111a15';
    ctx.lineWidth = 1;
    ctx.strokeRect(c.width - 112, 12, 100, 120);
    ctx.fillStyle = '#111a15';
    ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('U', cx, 32);
    ctx.beginPath();
    ctx.moveTo(cx, 36);
    ctx.lineTo(cx + 6, 50);
    ctx.lineTo(cx - 6, 50);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, 92);
    ctx.rotate(((windFromDeg + 180) * Math.PI) / 180);
    ctx.fillStyle = '#1f63c6';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(10, 12);
    ctx.lineTo(0, 5);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#111a15';
    ctx.fillText('Arah angin', cx, 126);
    ctx.textAlign = 'left';

    // skala 4 km
    const px4 = (4000 / scenario.grid.cellSizeM) * scale;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fillRect(12, c.height - 44, px4 + 24, 32);
    ctx.fillStyle = '#111a15';
    ctx.fillRect(24, c.height - 24, px4, 5);
    ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('0', 22, c.height - 29);
    ctx.fillText('4 km', 24 + px4 - 26, c.height - 29);
  }, [v, scenario, ign, windFromDeg]);
  return <canvas ref={ref} className="h-auto w-full border border-ink/20" role="img" aria-label={`Peta ${v.title}`} />;
}

function Sec({ n, title, children, className = '' }: { n: number; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mt-7 break-inside-avoid ${className}`}>
      <h2 className="mb-3 border-b-2 border-ink pb-1 text-[15px] font-bold text-ink">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

export default function Report({ id }: { id: string }) {
  const [sim, setSim] = useState<SavedSimulation | null>(null);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [copied, setCopied] = useState(false);
  const [slide, setSlide] = useState(0);
  const isNew = useSearchParams().get('baru') === '1';
  const computed = useVariants(sim, scenario);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/simulations/${id}`);
        if (res.status === 404) return setState('notfound');
        if (!res.ok) throw new Error();
        const data = (await res.json()) as SavedSimulation;
        const sc = (await (await fetch(`/data/scenarios/${data.scenarioSlug}.json`)).json()) as ScenarioData;
        setSim(data);
        setScenario(sc);
        const ap = data.recommendations.find((r) => r.applied);
        setSlide(ap ? data.recommendations.indexOf(ap) + 1 : 0);
        setState('ok');
      } catch {
        setState('error');
      }
    })();
  }, [id]);

  if (state === 'loading' || (state === 'ok' && !computed))
    return (
      <div className="mx-auto max-w-[860px] space-y-4 px-4 py-16" role="status" aria-label="Memuat laporan">
        <div className="skeleton-light h-10 w-2/3 rounded-lg" />
        <div className="skeleton-light h-5 w-1/2 rounded" />
        <div className="skeleton-light h-[420px] w-full rounded-[20px]" />
      </div>
    );
  if (state !== 'ok' || !sim || !scenario || !computed) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-2xl font-bold">{state === 'notfound' ? 'Laporan tidak ditemukan' : 'Laporan gagal dimuat'}</h1>
        <p className="mt-2 text-ink-2">Tautan mungkin salah atau laporan sudah dihapus.</p>
        <Link href="/simulator" className={buttonClass('primary', 'light', 'md', 'mt-6')}>
          Kembali ke simulator
        </Link>
      </div>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href.replace('?baru=1', ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { variants, ign, ignitions } = computed;
  const base = variants[0];
  const applied = sim.recommendations.find((r) => r.applied) ?? null;
  const final = applied ? variants.find((v) => v.rec?.rank === applied.rank) ?? base : base;
  const villages = [...final.risks].sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99));
  const baseRisk = new Map(base.risks.map((r) => [r.villageName, r]));
  const threatened = villages.filter((v) => v.etaHours !== null);
  const pop = new Map(scenario.villages.map((v) => [v.name, v]));
  const created = new Date(sim.createdAt);
  const dateStr = created.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' });
  const reportNo = `AR-${created.toISOString().slice(0, 10).replace(/-/g, '')}-${sim.id.slice(0, 6).toUpperCase()}`;

  // Kembali ke simulator dengan konfigurasi yang sama (angin, kekeringan, titik api, sekat).
  const sortIds = (a: number[]) => [...a].sort((x, y) => x - y).join(',');
  const defaultIgn = ignitions.length === 0 || sortIds(scenario.ignitions) === sortIds(ignitions);
  const q = new URLSearchParams({
    scenario: sim.scenarioSlug,
    angin: String(sim.windMs),
    arah: String(sim.windFromDeg),
    kering: String(sim.summary.dryness),
  });
  if (!defaultIgn) q.set('api', `${ign[0].toFixed(6)},${ign[1].toFixed(6)}`);
  if (applied) q.set('sekat', String(applied.rank));
  const backHref = `/simulator?${q.toString()}`;

  const cur = variants[Math.min(slide, variants.length - 1)];
  const go = (d: number) => setSlide((slide + d + variants.length) % variants.length);

  const briefLines = (sim.aiBriefing ?? '').replace(/\*\*/g, '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <div className="min-h-dvh bg-paper py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 max-w-[900px] px-4">
        {isNew && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-forest-950 p-4 pl-5 text-white" role="status">
            <p className="flex items-center gap-2 font-semibold">
              <span className="grid size-7 place-items-center rounded-full bg-white text-forest-950">
                <IconCheck size={16} />
              </span>
              Laporan tersimpan. Tautan ini siap dibagikan ke BPBD.
            </p>
            <Button size="sm" className="!bg-white !text-forest-950 hover:!bg-forest-100" onClick={copy}>
              <IconLink size={16} /> {copied ? 'Tautan tersalin' : 'Salin tautan'}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref} className={buttonClass('ghost', 'light', 'sm')}>
            <IconArrowLeft size={16} /> Kembali ke simulator (kondisi sama)
          </Link>
          <div className="ml-auto flex gap-2">
            {!isNew && (
              <Button variant="secondary" size="sm" onClick={copy}>
                <IconLink size={16} /> {copied ? 'Tautan tersalin' : 'Salin tautan'}
              </Button>
            )}
            <Button size="sm" onClick={() => window.print()}>
              <IconPrint size={16} /> Cetak atau simpan PDF
            </Button>
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-[900px] bg-white px-6 py-8 text-ink shadow-card sm:px-12 sm:py-10 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {/* Kop laporan */}
        <header className="flex items-start justify-between gap-4 border-b-[3px] border-double border-ink pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Laporan prediksi sebaran kebakaran lahan</p>
            <h1 className="mt-1 text-[24px] font-bold leading-tight">
              {sim.scenarioName}, {sim.province}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold">
            <LogoMark size={26} /> ApiRimba AI
          </div>
        </header>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {[
              ['Nomor', <span key="n" className="font-mono text-[13px]">{reportNo}</span>],
              ['Waktu dibuat', `${dateStr} WIB`],
              ['Titik awal api', `${fmtCoord(ign[0], ign[1])} (GPS ${decCoord(ign[0], ign[1])})`],
              ['Kondisi', `Angin ${nf(sim.windMs)} m/s dari ${compass(sim.windFromDeg)} (api terdorong ke ${compass(sim.windFromDeg + 180)}), indeks kekeringan ${nf(sim.summary.dryness, 2)}`],
              ['Rentang prediksi', '12 jam ke depan'],
            ].map(([k, v]) => (
              <tr key={String(k)}>
                <td className="w-40 py-0.5 align-top text-ink-3">{k}</td>
                <td className="num py-0.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Sec n={1} title="Ringkasan">
          <p className="text-[15px] leading-7">
            Tanpa sekat, api diperkirakan membakar <b>{nf(base.km2)} km²</b> dalam 12 jam
            {threatened[0] ? (
              <>
                {' '}
                dan mencapai <b>{threatened[0].villageName}</b> paling dulu, sekitar <b>{nf(threatened[0].etaHours ?? 0)} jam</b> lagi
              </>
            ) : (
              ' tanpa menjangkau desa'
            )}
            .{' '}
            {applied ? (
              <>
                Dengan <b>Sekat {BREAK_LABELS[applied.rank - 1]}</b>, luas terbakar turun menjadi <b>{nf(final.km2)} km²</b> (−
                {nf(applied.reductionPct)}%).
              </>
            ) : (
              'Belum ada sekat yang diterapkan pada simulasi ini.'
            )}
          </p>
          <table className="num mt-3 w-full border border-ink/30 text-sm">
            <thead className="bg-sunken text-left">
              <tr>
                <th className="border-b border-ink/30 px-3 py-1.5 font-semibold">Skenario</th>
                <th className="border-b border-ink/30 px-3 py-1.5 text-right font-semibold">Luas terbakar 12 jam</th>
                <th className="border-b border-ink/30 px-3 py-1.5 text-right font-semibold">Desa terjangkau</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.key} className={v === final ? 'font-semibold' : ''}>
                  <td className="border-b border-ink/15 px-3 py-1.5">
                    {v.rec && <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: BREAK_COLORS_PRINT[v.rec.rank - 1] }} />}
                    {v.title}
                    {v.rec?.applied ? ' (diterapkan)' : ''}
                  </td>
                  <td className="border-b border-ink/15 px-3 py-1.5 text-right">{nf(v.km2)} km²</td>
                  <td className="border-b border-ink/15 px-3 py-1.5 text-right">
                    {v.risks.filter((r) => r.etaHours !== null).length} dari {v.risks.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>

        <Sec n={2} title="Peta perkiraan area terbakar">
          {/* Layar: satu peta per varian, geser dengan panah. Cetak: semua varian. */}
          <div className="no-print">
            <div className="mb-2 flex items-center gap-2">
              <button onClick={() => go(-1)} className={buttonClass('secondary', 'light', 'sm')} aria-label="Peta sebelumnya">
                <IconChevronLeft size={16} />
              </button>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1" role="tablist" aria-label="Pilih peta">
                {variants.map((v, k) => (
                  <button
                    key={v.key}
                    role="tab"
                    aria-selected={k === slide}
                    onClick={() => setSlide(k)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold ${k === slide ? 'bg-ink text-white' : 'bg-sunken text-ink-2 hover:bg-line'}`}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
              <button onClick={() => go(1)} className={buttonClass('secondary', 'light', 'sm')} aria-label="Peta berikutnya">
                <IconChevronRight size={16} />
              </button>
            </div>
            <ReportMap v={cur} scenario={scenario} ign={ign} windFromDeg={sim.windFromDeg} />
            <p className="num mt-1.5 text-sm">
              <b>{cur.title}</b>: {nf(cur.km2)} km² terbakar
              {cur.rec ? ` (${nf(base.km2 - cur.km2)} km² lebih kecil dari tanpa sekat)` : ''}. Peta {slide + 1} dari {variants.length}.
            </p>
          </div>
          <div className="hidden grid-cols-2 gap-4 print:grid">
            {variants.map((v) => (
              <figure key={v.key} className="break-inside-avoid">
                <ReportMap v={v} scenario={scenario} ign={ign} windFromDeg={sim.windFromDeg} />
                <figcaption className="num mt-1 text-xs">
                  <b>{v.title}</b>: {nf(v.km2)} km²
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-3">
            Merah tua = terbakar lebih awal, oranye muda = terbakar menjelang jam ke-12 (peluang ≥ 25%). Kotak berwarna = desa menurut
            level. Peta tutupan lahan adalah ilustrasi.
          </p>
        </Sec>

        <Sec n={3} title={`Desa dan perkiraan waktu tiba api${applied ? ` (dengan Sekat ${BREAK_LABELS[applied.rank - 1]})` : ''}`}>
          <table className="num w-full border border-ink/30 text-sm">
            <thead className="bg-sunken text-left">
              <tr>
                <th className="border-b border-ink/30 px-3 py-1.5 font-semibold">Desa</th>
                <th className="border-b border-ink/30 px-3 py-1.5 font-semibold">Koordinat</th>
                <th className="border-b border-ink/30 px-3 py-1.5 font-semibold">Penduduk</th>
                <th className="border-b border-ink/30 px-3 py-1.5 font-semibold">Api tiba</th>
                <th className="border-b border-ink/30 px-3 py-1.5 font-semibold">Level</th>
              </tr>
            </thead>
            <tbody>
              {villages.map((v) => {
                const p = pop.get(v.villageName);
                const b = baseRisk.get(v.villageName);
                return (
                  <tr key={v.villageName}>
                    <td className="border-b border-ink/15 px-3 py-1.5 font-semibold">{v.villageName}</td>
                    <td className="border-b border-ink/15 px-3 py-1.5 text-xs">{p ? fmtCoord(p.lon, p.lat) : '-'}</td>
                    <td className="border-b border-ink/15 px-3 py-1.5">±{(p?.population ?? 0).toLocaleString('id-ID')}</td>
                    <td className="border-b border-ink/15 px-3 py-1.5">
                      {v.etaHours === null ? 'Tidak dalam 12 jam' : `±${nf(v.etaHours)} jam`}
                      {applied && b && b.etaHours !== v.etaHours && (
                        <span className="block text-[11px] text-ink-3">tanpa sekat: {b.etaHours === null ? 'tidak terjangkau' : `${nf(b.etaHours)} jam`}</span>
                      )}
                    </td>
                    <td className="border-b border-ink/15 px-3 py-1.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <span className="size-2.5 rounded-full" style={{ background: LEVEL_COLOR[v.level] }} />
                        {LEVEL_LABEL[v.level]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1.5 text-xs text-ink-3">Awas: api kurang dari 4 jam. Siaga: 4 sampai 8 jam. Waspada: lebih dari 8 jam. Aman: tidak terjangkau.</p>
        </Sec>

        <Sec n={4} title="Rencana sekat bakar">
          {sim.recommendations.length === 0 ? (
            <p className="text-sm text-ink-2">Pencarian sekat belum dijalankan pada simulasi ini.</p>
          ) : (
            <div className="space-y-3">
              {sim.recommendations.map((r) => {
                const L = BREAK_LABELS[r.rank - 1];
                const d = describeBreak(r.line.coordinates, ign, scenario.villages);
                const v = variants.find((x) => x.rec?.rank === r.rank);
                return (
                  <div key={r.rank} className="break-inside-avoid border border-ink/30">
                    <div className="flex items-center justify-between gap-2 border-b border-ink/30 bg-sunken px-3 py-1.5">
                      <p className="font-bold">
                        <span className="mr-2 inline-block size-3 rounded-full align-middle" style={{ background: BREAK_COLORS_PRINT[r.rank - 1] }} />
                        Sekat {L}
                        {r.applied && <span className="ml-2 text-sm font-semibold text-forest-800">Diterapkan</span>}
                      </p>
                      <p className="num text-sm text-ink-2">skor {nf(r.score, 0)}/100</p>
                    </div>
                    <table className="num w-full text-sm">
                      <tbody>
                        {[
                          [`Titik awal (${L}1)`, `${fmtCoord(d.from[0], d.from[1])}  ·  GPS ${decCoord(d.from[0], d.from[1])}`],
                          [`Titik akhir (${L}2)`, `${fmtCoord(d.to[0], d.to[1])}  ·  GPS ${decCoord(d.to[0], d.to[1])}`],
                          ['Ukuran', `Panjang ${nf(r.lengthKm, 2)} km, lebar ${r.widthM} m, arah ${orientation(d.from, d.to)}`],
                          ['Posisi', `${nf(d.distKm)} km di ${d.direction} titik api${d.nearestVillage ? `; desa terdekat ${d.nearestVillage.name} (${nf(d.nearestVillage.km)} km)` : ''}`],
                          ['Batas waktu', `Selesai dalam ${nf(r.marginHours + FIREBREAK_BUILD_HOURS)} jam sejak laporan (estimasi pembangunan ${FIREBREAK_BUILD_HOURS} jam, sisa ${nf(r.marginHours)} jam)`],
                          ['Dampak', `Luas terbakar −${nf(r.reductionPct)}%${v ? `, dari ${nf(base.km2)} menjadi ${nf(v.km2)} km²` : ''}`],
                          ...(r.peatBypassRisk ? [['Catatan', 'Melintasi gambut kering: basahi gambut di sepanjang jalur atau buat sekat kanal.']] : []),
                        ].map(([k, val]) => (
                          <tr key={k}>
                            <td className="w-36 border-b border-ink/10 px-3 py-1 align-top text-ink-3">{k}</td>
                            <td className="border-b border-ink/10 px-3 py-1">{val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </Sec>

        {briefLines.length > 0 && (
          <Sec n={5} title="Briefing untuk posko">
            <div className="text-[15px] leading-7">
              {briefLines.map((l, k) =>
                ['SITUASI', 'PRIORITAS TINDAKAN', 'CATATAN'].includes(l.replace(/:$/, '').toUpperCase()) ? (
                  <p key={k} className="mt-2 text-sm font-bold first:mt-0">
                    {l.replace(/:$/, '').charAt(0) + l.replace(/:$/, '').slice(1).toLowerCase()}
                  </p>
                ) : /^[-*]\s/.test(l) ? (
                  <p key={k} className="relative pl-5 before:absolute before:left-1 before:content-['–']">
                    {l.slice(2)}
                  </p>
                ) : (
                  <p key={k}>{l}</p>
                ),
              )}
            </div>
          </Sec>
        )}

        <Sec n={briefLines.length > 0 ? 6 : 5} title="Asumsi dan sumber data">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
            <li>Model cellular automata 64 x 64 sel (250 m), langkah 15 menit, 12 kali simulasi; angin dianggap seragam 12 jam.</li>
            <li>Koefisien belum dikalibrasi dengan kebakaran historis. Tutupan lahan, gambut, dan nama desa adalah ilustrasi.</li>
            <li>
              Data: NASA FIRMS (titik panas), Open-Meteo (cuaca). Sumber pada simulasi ini:{' '}
              {sim.dataSource === 'live' ? 'data langsung' : sim.dataSource === 'demo' ? 'data cadangan (offline)' : 'data cadangan'}.
            </li>
          </ul>
        </Sec>

        <footer className="mt-8 grid grid-cols-2 gap-8 border-t border-ink/30 pt-4 text-sm">
          <div>
            <p className="text-ink-3">Disusun oleh</p>
            <p className="font-semibold">ApiRimba AI (otomatis)</p>
          </div>
          <div>
            <p className="text-ink-3">Diperiksa oleh petugas</p>
            <p className="mt-6 border-b border-ink/40" />
            <p className="mt-1 text-xs text-ink-3">Nama, jabatan, tanda tangan</p>
          </div>
          <p className="col-span-2 text-xs font-medium text-ink-2">
            Prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan.
          </p>
        </footer>
      </article>
    </div>
  );
}
