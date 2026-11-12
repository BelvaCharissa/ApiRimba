'use client';

import { ArrowLeft, Copy, Printer } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '@/components/ui/Logo';
import { compass, etaText, LEVEL_COLOR, LEVEL_LABEL, nf } from '@/lib/format';
import { paintFire, paintLand } from '@/lib/render';
import type { ScenarioData } from '@/lib/scenario';
import { base64ToInt16 } from '@/lib/sim/grid';
import type { RiskLevel } from '@/lib/sim/types';

interface SavedSimulation {
  id: string;
  createdAt: string;
  scenarioSlug: string;
  scenarioName: string;
  province: string;
  windMs: number;
  windFromDeg: number;
  steps: number;
  stepMinutes: number;
  dataSource: string;
  summary: { burnedKm2By12h: number; burnedKm2WithFirebreak: number | null; dryness: number };
  arrivalB64: string;
  firebreakApplied: boolean;
  aiBriefing: string | null;
  recommendations: {
    rank: number;
    line: { coordinates: [number, number][] };
    lengthKm: number;
    score: number;
    reductionPct: number;
    marginHours: number;
    peatBypassRisk: boolean;
    note: string;
    applied: boolean;
  }[];
  villageRisks: { villageName: string; variant: string; etaHours: number | null; burnProbability: number; level: RiskLevel }[];
}

const LABELS = ['A', 'B', 'C'];

function ReportMap({ sim, scenario }: { sim: SavedSimulation; scenario: ScenarioData }) {
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
    tctx.putImageData(land, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, c.width, c.height);

    const arrival = base64ToInt16(sim.arrivalB64);
    const burnUntil = new Int16Array(arrival.length).fill(32767);
    const fire = tctx.createImageData(w, h);
    paintFire(fire, { arrival, burnUntil, prob: null, meanArrival: null }, sim.steps, { showProbability: false });
    // ubah semua sel terbakar menjadi warna area terbakar yang jelas di kertas
    for (let i = 0; i < arrival.length; i++) {
      if (arrival[i] >= 0) {
        const late = arrival[i] / sim.steps;
        fire.data[i * 4] = 230 - late * 40;
        fire.data[i * 4 + 1] = 70 + late * 90;
        fire.data[i * 4 + 2] = 40;
        fire.data[i * 4 + 3] = 215;
      }
    }
    tctx.putImageData(fire, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, 0, 0, c.width, c.height);

    const toPx = (lon: number, lat: number): [number, number] => [
      ((lon - scenario.grid.originLon) / scenario.grid.cellDegLon) * scale,
      ((scenario.grid.originLat - lat) / scenario.grid.cellDegLat) * scale,
    ];
    for (const r of sim.recommendations) {
      const [a, b] = r.line.coordinates.map(([lon, lat]) => toPx(lon, lat));
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#05130d';
      ctx.lineWidth = r.applied ? 12 : 8;
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
      ctx.strokeStyle = r.applied ? '#3ddc97' : '#9fe9c8';
      ctx.lineWidth = r.applied ? 7 : 4;
      ctx.stroke();
      ctx.font = '600 16px Inter, sans-serif';
      ctx.fillStyle = '#05130d';
      ctx.fillText(`Sekat ${LABELS[r.rank - 1]}`, (a[0] + b[0]) / 2 + 10, (a[1] + b[1]) / 2 - 10);
    }
    const final = new Map(
      sim.villageRisks
        .filter((v) => v.variant === (sim.firebreakApplied ? 'with_firebreak' : 'baseline'))
        .map((v) => [v.villageName, v]),
    );
    for (const v of scenario.villages) {
      const [x, y] = toPx(v.lon, v.lat);
      const level = final.get(v.name)?.level ?? 'aman';
      ctx.fillStyle = LEVEL_COLOR[level];
      ctx.strokeStyle = '#14201a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = '600 15px Inter, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(v.name, x + 14, y + 5);
      ctx.fillStyle = '#14201a';
      ctx.fillText(v.name, x + 14, y + 5);
    }
    // panah angin
    const to = ((sim.windFromDeg + 180) * Math.PI) / 180;
    const cx = c.width - 60;
    const cy = 60;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(to);
    ctx.fillStyle = '#0b6d99';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(12, 14);
    ctx.lineTo(0, 6);
    ctx.lineTo(-12, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [sim, scenario]);
  return <canvas ref={ref} className="h-auto w-full rounded-card border border-line" role="img" aria-label="Peta hasil simulasi" />;
}

export default function Report({ id }: { id: string }) {
  const [sim, setSim] = useState<SavedSimulation | null>(null);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [copied, setCopied] = useState(false);

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
        setState('ok');
      } catch {
        setState('error');
      }
    })();
  }, [id]);

  if (state === 'loading') return <p className="p-10 text-center text-ink-2">Memuat laporan...</p>;
  if (state !== 'ok' || !sim || !scenario) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-2xl font-bold">{state === 'notfound' ? 'Laporan tidak ditemukan' : 'Laporan gagal dimuat'}</h1>
        <p className="mt-2 text-ink-2">Tautan mungkin salah atau laporan sudah dihapus.</p>
        <Link href="/simulator" className="mt-6 inline-block rounded-full bg-forest-900 px-5 py-2.5 font-semibold text-white">
          Kembali ke simulator
        </Link>
      </div>
    );
  }

  const variant = sim.firebreakApplied ? 'with_firebreak' : 'baseline';
  const villages = sim.villageRisks.filter((v) => v.variant === variant).sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99));
  const baseMap = new Map(sim.villageRisks.filter((v) => v.variant === 'baseline').map((v) => [v.villageName, v]));
  const applied = sim.recommendations.find((r) => r.applied);
  const threatened = villages.filter((v) => v.etaHours !== null);
  const created = new Date(sim.createdAt);
  const dateStr = created.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' });

  return (
    <div className="min-h-dvh bg-paper py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[860px] flex-wrap items-center gap-2 px-4">
        <Link href="/simulator" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink-2 hover:bg-white">
          <ArrowLeft size={16} /> Kembali ke simulator
        </Link>
        <div className="ml-auto flex gap-2">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:border-ink-3"
          >
            <Copy size={15} /> {copied ? 'Tautan tersalin' : 'Salin tautan'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full bg-forest-900 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"
          >
            <Printer size={15} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-[860px] bg-white px-6 py-8 shadow-soft sm:px-10 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cta-ink">Laporan simulasi sebaran api</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{sim.scenarioName}</h1>
            <p className="mt-1 text-sm text-ink-2">
              {sim.province} · {dateStr} WIB · Prediksi 12 jam
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <LogoMark size={28} /> ApiRimba AI
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Luas terbakar tanpa sekat', `${nf(sim.summary.burnedKm2By12h)} km²`],
            [
              'Dengan sekat',
              sim.summary.burnedKm2WithFirebreak !== null ? `${nf(sim.summary.burnedKm2WithFirebreak)} km²` : 'Belum diterapkan',
            ],
            ['Angin', `${nf(sim.windMs)} m/s dari ${compass(sim.windFromDeg)}`],
            ['Desa terjangkau 12 jam', `${threatened.length} dari ${villages.length}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-card border border-line p-3">
              <p className="text-xs text-ink-3">{k}</p>
              <p className="mt-0.5 font-mono text-base font-semibold">{v}</p>
            </div>
          ))}
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">Ringkasan</h2>
          <p className="text-[15px] leading-7">
            Dengan angin {nf(sim.windMs)} m/s dari arah {compass(sim.windFromDeg)} dan indeks kekeringan{' '}
            {nf(sim.summary.dryness, 2)}, api diperkirakan menjalar ke arah {compass(sim.windFromDeg + 180)} dan membakar sekitar{' '}
            {nf(sim.summary.burnedKm2By12h)} km² dalam 12 jam.{' '}
            {threatened[0] && `${threatened[0].villageName} adalah desa pertama yang terjangkau (sekitar ${nf(threatened[0].etaHours ?? 0)} jam). `}
            {applied &&
              sim.summary.burnedKm2WithFirebreak !== null &&
              `Penerapan Sekat ${LABELS[applied.rank - 1]} menurunkan perkiraan luas terbakar menjadi ${nf(sim.summary.burnedKm2WithFirebreak)} km².`}
          </p>
        </section>

        <section className="mt-5 break-inside-avoid">
          <ReportMap sim={sim} scenario={scenario} />
          <p className="mt-1.5 text-xs text-ink-3">
            Area oranye-merah: perkiraan area terbakar 12 jam ({sim.firebreakApplied ? 'dengan sekat' : 'tanpa sekat'}); garis hijau:
            sekat bakar; lingkaran: desa (warna menunjukkan level). Tutupan lahan adalah ilustrasi.
          </p>
        </section>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <section className="break-inside-avoid">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">Desa dan estimasi waktu tiba</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="py-1.5 font-medium">Desa</th>
                  <th className="py-1.5 font-medium">Estimasi</th>
                  <th className="py-1.5 font-medium">Level</th>
                </tr>
              </thead>
              <tbody>
                {villages.map((v) => {
                  const b = baseMap.get(v.villageName);
                  return (
                    <tr key={v.villageName} className="border-b border-line/70">
                      <td className="py-2 font-medium">{v.villageName}</td>
                      <td className="py-2 font-mono text-[13px]">
                        {etaText(v.etaHours)}
                        {sim.firebreakApplied && b && b.etaHours !== v.etaHours && (
                          <span className="block text-[11px] text-ink-3">tanpa sekat: {etaText(b.etaHours)}</span>
                        )}
                      </td>
                      <td className="py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${LEVEL_COLOR[v.level]}33` }}>
                          {LEVEL_LABEL[v.level]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="break-inside-avoid">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">Rekomendasi sekat bakar</h2>
            {sim.recommendations.length === 0 && <p className="text-sm text-ink-2">Belum ada rekomendasi sekat pada simulasi ini.</p>}
            <ol className="space-y-2">
              {sim.recommendations.map((r) => (
                <li key={r.rank} className={`rounded-card border p-3 text-sm ${r.applied ? 'border-firebreak-ink bg-forest-100' : 'border-line'}`}>
                  <p className="font-semibold">
                    Sekat {LABELS[r.rank - 1]} · skor {nf(r.score, 0)}
                    {r.applied && <span className="ml-2 text-xs font-medium text-firebreak-ink">diterapkan</span>}
                  </p>
                  <p className="font-mono text-xs text-ink-2">
                    {nf(r.lengthKm)} km · margin {nf(r.marginHours)} jam · luas −{nf(r.reductionPct)}%
                  </p>
                  {r.peatBypassRisk && <p className="mt-1 text-xs text-ink-2">Perlu pembasahan gambut atau sekat kanal.</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {sim.aiBriefing && (
          <section className="mt-6 break-inside-avoid rounded-card border border-line bg-paper p-4 print:bg-white">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">AI Briefing</h2>
            <div className="whitespace-pre-line text-sm leading-6">{sim.aiBriefing.replace(/\*\*/g, '')}</div>
          </section>
        )}

        <footer className="mt-6 border-t border-line pt-4 text-xs leading-5 text-ink-3">
          <p>
            <b>Asumsi model:</b> cellular automata grid 64 x 64 (sel 250 m, langkah 15 menit), 12 run Monte Carlo, angin seragam.
            Koefisien belum dikalibrasi dengan data historis. Tutupan lahan, gambut, dan nama desa adalah ilustrasi.
          </p>
          <p className="mt-1">
            <b>Sumber data:</b> NASA FIRMS (titik panas), Open-Meteo (cuaca), sumber data simulasi: {sim.dataSource}. ID laporan:{' '}
            <span className="font-mono">{sim.id}</span>
          </p>
          <p className="mt-1 font-medium text-ink-2">
            Prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan.
          </p>
        </footer>
      </article>
    </div>
  );
}
