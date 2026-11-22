'use client';

import { useEffect, useMemo, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { IconArrowLeft, IconArrowRight, IconPause, IconPlay } from '@/components/ui/icons';
import SiteHeader from '@/components/ui/SiteHeader';
import { compass, LEVEL_COLOR, LEVEL_LABEL, nf } from '@/lib/format';
import { ignitionPoint } from '@/lib/geo';
import type { ScenarioData } from '@/lib/scenario';
import { burnedByStep, cellsToKm2, runMonteCarlo } from '@/lib/sim/engine';
import { buildSimInput } from '@/lib/sim/input';
import { DEFAULT_SEED, STEP_MINUTES, STEPS_12H } from '@/lib/sim/params';
import { villageRisks } from '@/lib/sim/risk';

/* Posisi grid simulasi di foto satelit (lihat scripts/build-hero.mjs dan public/img/hero-riau.json). */
const IMG = { w: 2400, h: 1350 };
const AREA = { x: 600, y: 75, w: 1200, h: 1200 };
const WIND_MS = 7;
const STEPS_PER_HOUR = 60 / STEP_MINUTES;

const WINDS = [
  { value: 225, en: 'South-west', id: 'Barat daya' },
  { value: 315, en: 'North-west', id: 'Barat laut' },
  { value: 180, en: 'South', id: 'Selatan' },
] as const;


const glass = 'glass rounded-[20px]';

export default function LandingHero() {
  const tr = useT();
  const [data, setData] = useState<ScenarioData | null>(null);
  const [wind, setWind] = useState<number>(225);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch('/data/scenarios/riau.json')
      .then((r) => r.json())
      .then((d: ScenarioData) => setData(d))
      .catch(() => undefined);
  }, []);

  const result = useMemo(() => {
    if (!data) return null;
    const mc = runMonteCarlo(buildSimInput(data, { windMs: WIND_MS, windFromDeg: wind }), DEFAULT_SEED, 12);
    const risks = villageRisks(data.grid, data.villages, mc.prob, mc.meanArrival, STEP_MINUTES);
    return {
      mc,
      km2: burnedByStep(mc.representative.arrival, STEPS_12H).map((c) => cellsToKm2(c, data.grid.cellSizeM)),
      risks: [...risks].sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99)),
    };
  }, [data, wind]);

  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = setInterval(() => {
      setT((v) => {
        if (reduce || v >= STEPS_12H) {
          if (reduce) setPlaying(false);
          return reduce ? STEPS_12H : v;
        }
        if (v >= STEPS_12H) {
          setPlaying(false);
          return v;
        }
        return v + 1;
      });
    }, 140);
    return () => clearInterval(id);
  }, [playing]);

  // lapisan api: 64 x 64 piksel, diperbesar halus oleh browser di atas foto
  const fireUrl = useMemo(() => {
    if (!data || !result || typeof document === 'undefined') return null;
    const { w, h } = data.grid;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(w, h);
    const arr = result.mc.representative.arrival;
    const until = result.mc.representative.burnUntil;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const a = arr[i];
      let px: [number, number, number, number] = [0, 0, 0, 0];
      if (a >= 0 && a <= t) {
        if (t < until[i]) px = t - a > 3 ? [228, 64, 28, 235] : [255, 206, 74, 245];
        else px = [28, 18, 14, 140];
      } else if (result.mc.prob[i] >= 0.3) {
        px = [255, 140, 60, Math.round(result.mc.prob[i] * 70)];
      }
      img.data.set(px, o);
    }
    ctx.putImageData(img, 0, 0);
    // perbesar 4x dengan sedikit blur agar tepi api tidak kotak-kotak
    const big = document.createElement('canvas');
    big.width = w * 4;
    big.height = h * 4;
    const bctx = big.getContext('2d');
    if (!bctx) return c.toDataURL();
    bctx.filter = 'blur(2px)';
    bctx.imageSmoothingEnabled = true;
    bctx.drawImage(c, 0, 0, big.width, big.height);
    return big.toDataURL();
  }, [data, result, t]);

  const toImg = (lon: number, lat: number) => {
    if (!data) return { x: 0, y: 0 };
    const g = data.grid;
    return {
      x: AREA.x + ((lon - g.originLon) / g.cellDegLon / g.w) * AREA.w,
      y: AREA.y + ((g.originLat - lat) / g.cellDegLat / g.h) * AREA.h,
    };
  };

  const hours = (t * STEP_MINUTES) / 60;
  const hourNow = Math.floor(hours);
  const km2 = result ? result.km2[t] : 0;
  const risks = result?.risks ?? [];
  const reachable = risks.filter((r) => r.etaHours !== null);
  const first = reachable[0];
  const ign = data ? ignitionPoint(data.grid, data.ignitions) : null;
  const ignPx = ign ? toImg(ign[0], ign[1]) : null;
  const maxKm2 = result ? result.km2[STEPS_12H] || 1 : 1;
  const dryness = data ? `${Math.round(data.defaultDryness * 100)}%` : '-';

  const jump = (steps: number) => {
    setPlaying(false);
    setT((v) => Math.max(0, Math.min(STEPS_12H, v + steps)));
  };

  return (
    <section className="relative isolate overflow-hidden bg-[#0b1d15] text-white lg:m-3 lg:h-[calc(100svh-24px)] lg:max-h-[980px] lg:min-h-[760px] lg:rounded-[28px]">
      {/* latar: foto satelit + api hasil simulasi */}
      <div className="absolute inset-x-0 top-[200px] -z-10 h-[640px] lg:inset-0 lg:h-auto">
        <svg
          viewBox={`0 0 ${IMG.w} ${IMG.h}`}
          preserveAspectRatio="xMidYMid slice"
          className="size-full"
          role="img"
          aria-label={tr('Satellite photo of peatland in Riau with the simulated fire spread', 'Foto satelit lahan gambut di Riau dengan sebaran api hasil simulasi')}
        >
          <image href="/img/hero-riau.jpg" width={IMG.w} height={IMG.h} />
          <rect width={IMG.w} height={IMG.h} fill="#06120c" opacity="0.18" />
          {fireUrl && <image href={fireUrl} x={AREA.x} y={AREA.y} width={AREA.w} height={AREA.h} preserveAspectRatio="none" />}

          {/* batas area simulasi: hanya sudut, seperti bingkai kamera */}
          <g stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.5" fill="none">
            {[
              [AREA.x, AREA.y, 1, 1],
              [AREA.x + AREA.w, AREA.y, -1, 1],
              [AREA.x, AREA.y + AREA.h, 1, -1],
              [AREA.x + AREA.w, AREA.y + AREA.h, -1, -1],
            ].map(([x, y, dx, dy]) => (
              <path key={`${x}-${y}`} d={`M${x + dx * 40} ${y}H${x}V${y + dy * 40}`} />
            ))}
          </g>

          {/* desa */}
          {data &&
            data.villages.map((v) => {
              const p = toImg(v.lon, v.lat);
              const r = risks.find((x) => x.villageName === v.name);
              const reached = r?.etaHours != null && r.etaHours <= hours;
              const label =
                r?.etaHours == null ? tr('safe for 12 h', 'aman 12 jam') : reached ? tr('fire arrived', 'api tiba') : tr(`in ${nf(Math.max(0, r.etaHours - hours))} h`, `${nf(Math.max(0, r.etaHours - hours))} jam lagi`);
              const w = Math.max(v.name.length * 13.5, label.length * 11.5) + 36;
              const flip = p.x > AREA.x + AREA.w * 0.7;
              const bx = flip ? p.x - w - 22 : p.x + 22;
              return (
                <g key={v.name}>
                  <line x1={p.x} y1={p.y} x2={flip ? bx + w : bx} y2={p.y} stroke="#fff" strokeOpacity="0.7" strokeWidth="2" />
                  <circle cx={p.x} cy={p.y} r="9" fill={reached ? '#ee4b4b' : '#ffffff'} stroke="#0b1d15" strokeWidth="3" />
                  <rect x={bx} y={p.y - 30} width={w} height="60" rx="14" fill={reached ? '#b3261e' : '#ffffff'} />
                  <text x={bx + 16} y={p.y - 4} fontSize="24" fontWeight="700" fill={reached ? '#fff' : '#111a15'}>
                    {v.name}
                  </text>
                  <text x={bx + 16} y={p.y + 20} fontSize="20" fill={reached ? '#ffe3df' : '#3e4c44'}>
                    {label}
                  </text>
                </g>
              );
            })}

          {/* titik awal api */}
          {ignPx && (
            <g>
              <circle cx={ignPx.x} cy={ignPx.y} r="26" fill="none" stroke="#ffd24a" strokeWidth="4" />
              <circle cx={ignPx.x} cy={ignPx.y} r="9" fill="#ffd24a" />
            </g>
          )}
        </svg>
        {/* gelap di tepi agar panel terbaca; bukan efek kilau */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(6,18,12,.72)_0%,rgba(6,18,12,0)_32%,rgba(6,18,12,0)_68%,rgba(6,18,12,.72)_100%)] max-lg:bg-[linear-gradient(180deg,#0b1d15_0%,rgba(6,18,12,0)_18%,rgba(6,18,12,0)_75%,#0b1d15_100%)]" />
      </div>

      <div className="flex h-full flex-col px-4 pb-4 pt-4 sm:px-6 lg:px-7 lg:pb-6">
        <div className="-mx-4 -mt-4 sm:-mx-6 lg:-mx-7">
          <SiteHeader />
        </div>

        <div className="mt-6 grid flex-1 grid-cols-[minmax(0,1fr)] gap-3 lg:mt-8 lg:grid-cols-[360px_1fr_320px] lg:gap-5">
          {/* kolom kiri */}
          <div className="flex flex-col gap-3">
            <div className="mb-[500px] lg:mb-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="grad-sun rounded-full px-2.5 py-1">{tr('Sample scenario', 'Skenario contoh')}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b3261e] px-2.5 py-1">
                  <span className={`size-1.5 rounded-full bg-white ${playing ? 'animate-pulse' : ''}`} />
                  {playing ? tr('Simulation running', 'Simulasi berjalan') : tr('Paused', 'Dijeda')}
                </span>
              </div>
              <h1 className="mt-4 text-[38px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[44px]">
                {tr('Riau peatland,', 'Gambut Riau,')}
                <br />
                {tr('the next 12 hours', '12 jam ke depan')}
              </h1>
              <p className="mt-3 max-w-[340px] text-[15px] leading-6 text-white/75">
                {tr('Where the fire spreads, which village it reaches first, and when. Recalculated every time the wind changes.', 'Ke mana api menjalar, desa mana yang kena duluan, dan kapan. Dihitung ulang tiap kali angin berubah.')}
              </p>
            </div>

            <div className={`${glass} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{tr('Field conditions', 'Kondisi lapangan')}</p>
                <span className="text-xs text-white/55">{tr('wind from', 'angin dari')}</span>
              </div>
              <div className="mt-3 flex items-end gap-3">
                <p className="text-5xl font-bold leading-none tracking-tight">
                  <span className="num">{WIND_MS}</span>
                </p>
                <p className="pb-1 text-sm text-white/75">
                  {tr('m/s, from the', 'm/s, dari')} {compass(wind)}
                </p>
                <svg width="40" height="40" viewBox="0 0 40 40" className="ml-auto" aria-hidden="true">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
                  <path
                    d="M20 6l7 22-7-4.5-7 4.5z"
                    fill="#9fd8f5"
                    style={{ transform: `rotate(${(wind + 180) % 360}deg)`, transformOrigin: '20px 20px', transition: 'transform 300ms ease' }}
                  />
                </svg>
              </div>
              <div role="radiogroup" aria-label={tr('Wind direction', 'Arah angin')} className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-black/25 p-1">
                {WINDS.map((w) => (
                  <button
                    key={w.value}
                    role="radio"
                    aria-checked={wind === w.value}
                    onClick={() => {
                      setWind(w.value);
                      setT(0);
                      setPlaying(true);
                    }}
                    className={`rounded-full px-2 py-1.5 text-xs font-semibold transition-colors ${
                      wind === w.value ? 'bg-white text-[#0b1d15]' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {tr(w.en, w.id)}
                  </button>
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[12px] bg-black/25 p-3">
                  <dt className="text-xs text-white/60">{tr('Peat dryness', 'Kekeringan gambut')}</dt>
                  <dd className="num mt-1 text-xl font-semibold">{dryness}</dd>
                </div>
                <div className="rounded-[12px] bg-black/25 p-3">
                  <dt className="text-xs text-white/60">{tr('Area', 'Luas area')}</dt>
                  <dd className="num mt-1 text-xl font-semibold">16 × 16 km</dd>
                </div>
              </dl>
            </div>

            <div className={`${glass} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{tr('Note for the command post', 'Catatan untuk posko')}</p>
                <span className="num text-xs text-white/55">{tr('auto draft', 'draf otomatis')}</span>
              </div>
              <p className="mt-2 text-[15px] leading-6 text-white/85">
                {first ? (
                  <>
                    {tr(`Wind ${WIND_MS} m/s from the ${compass(wind)}.`, `Angin ${WIND_MS} m/s dari ${compass(wind)}.`)} <b className="text-[#ffd24a]">{first.villageName}</b>{' '}
                    {tr('is reached first, about', 'terjangkau pertama, sekitar')} <b className="num">{tr(`${nf(first.etaHours ?? 0)} h`, `${nf(first.etaHours ?? 0)} jam`)}</b>{' '}
                    {tr('from the ignition point. Prepare the way out before then.', 'dari titik awal. Siapkan jalur keluar sebelum itu.')}
                  </>
                ) : (
                  tr('Calculating spread...', 'Menghitung sebaran...')
                )}
              </p>
            </div>
          </div>

          {/* tengah: kontrol waktu di bawah */}
          <div className="order-last flex items-end justify-center lg:order-none">
            <div className={`${glass} flex w-full max-w-[460px] items-center gap-2 !rounded-full p-1.5`}>
              <button
                onClick={() => jump(-STEPS_PER_HOUR)}
                aria-label={tr('Back one hour', 'Mundur satu jam')}
                className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10"
              >
                <IconArrowLeft size={18} />
              </button>
              <div className="flex flex-1 items-center justify-center gap-4">
                <span className="text-center text-xs text-white/55">
                  <span className="num block text-sm font-semibold text-white/80">0</span>{tr('start', 'mulai')}
                </span>
                <span className="grid size-14 place-items-center rounded-full border border-white/25 bg-black/25 text-center">
                  <span>
                    <span className="num block text-xl font-bold leading-none">{hourNow}</span>
                    <span className="text-[10px] text-white/60">{tr('hour', 'jam')}</span>
                  </span>
                </span>
                <span className="text-center text-xs text-white/55">
                  <span className="num block text-sm font-semibold text-white/80">12</span>{tr('limit', 'batas')}
                </span>
              </div>
              <button
                onClick={() => jump(STEPS_PER_HOUR)}
                aria-label={tr('Forward one hour', 'Maju satu jam')}
                className="grid size-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10"
              >
                <IconArrowRight size={18} />
              </button>
              <button
                onClick={() => (t >= STEPS_12H ? (setT(0), setPlaying(true)) : setPlaying(!playing))}
                aria-label={playing ? tr('Pause', 'Jeda') : tr('Play', 'Putar')}
                className="grad-sun grid size-11 shrink-0 place-items-center rounded-full hover:brightness-105"
              >
                {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
              </button>
            </div>
          </div>

          {/* kolom kanan */}
          <div className="flex flex-col gap-3">
            <div className={`${glass} p-4`}>
              <p className="text-sm font-semibold">{tr(`At hour ${hourNow}`, `Pada jam ke-${hourNow}`)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
                {[
                  [tr('Burned', 'Terbakar'), `${nf(km2)} km²`],
                  [tr('Villages reached', 'Desa terjangkau'), `${reachable.length} ${tr('of', 'dari')} ${risks.length || 4}`],
                  [tr('First village', 'Desa pertama'), first ? tr(`${nf(first.etaHours ?? 0)} h`, `${nf(first.etaHours ?? 0)} jam`) : '-'],
                  [tr('Chance of fire', 'Peluang kena'), first ? `${Math.round(first.burnProbability * 100)}%` : '-'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-white/60">{k}</dt>
                    <dd className="num mt-0.5 text-xl font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className={`${glass} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{tr('Area burned per hour', 'Luas terbakar per jam')}</p>
                <span className="text-xs text-white/55">km²</span>
              </div>
              <div className="mt-3 flex h-20 items-end gap-1" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => {
                  const v = result ? result.km2[(i + 1) * STEPS_PER_HOUR] : 0;
                  const on = (i + 1) * STEPS_PER_HOUR <= t;
                  return (
                    <span
                      key={i}
                      className={`flex-1 rounded-[3px] transition-colors ${on ? 'bg-[linear-gradient(0deg,#9be15d,#ffd24a)]' : 'bg-white/15'}`}
                      style={{ height: `${Math.max(6, (v / maxKm2) * 100)}%` }}
                    />
                  );
                })}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {[3, 6, 12].map((h) => (
                  <div key={h}>
                    <dt className="text-white/60">{tr('hour', 'jam')} {h}</dt>
                    <dd className="num text-sm font-semibold">{result ? nf(result.km2[h * STEPS_PER_HOUR]) : '-'}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className={`${glass} p-4`}>
              <p className="text-sm font-semibold">{tr('Evacuation order', 'Urutan evakuasi')}</p>
              <ul className="mt-2 divide-y divide-white/10">
                {(risks.length ? risks : []).map((r) => (
                  <li key={r.villageName} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{r.villageName}</span>
                      <span className="num text-xs text-white/60">
                        {r.etaHours === null ? tr('not reached in 12 h', 'tidak terjangkau 12 jam') : tr(`arrives in ${nf(r.etaHours)} h`, `tiba ${nf(r.etaHours)} jam`)}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/25 px-2 py-0.5 text-xs font-semibold">
                      <span className="size-2 rounded-full" style={{ background: LEVEL_COLOR[r.level] }} aria-hidden="true" />
                      {LEVEL_LABEL[r.level]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-white/50 lg:absolute lg:bottom-5 lg:right-7 lg:mt-0 lg:max-w-[320px] lg:text-right">
          {tr('Imagery: Esri World Imagery, near the Siak River. Fire and villages are a sample scenario, not a real event.', 'Citra: Esri World Imagery, sekitar Sungai Siak. Api dan desa adalah skenario contoh, bukan kejadian nyata.')}
        </p>
      </div>
    </section>
  );
}
