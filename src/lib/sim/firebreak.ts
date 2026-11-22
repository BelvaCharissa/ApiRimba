import { locale, t } from '../i18n';
import { prepare, runSimulation } from './engine';
import { gridToLonLat, rasterLine } from './grid';
import { FIREBREAK_BUILD_HOURS, RISK_WEIGHT } from './params';
import { villageRisks } from './risk';
import {
  Fuel,
  type FirebreakCandidate,
  type FirebreakRecommendation,
  type RecommendResult,
  type SimInput,
  type VillageInput,
} from './types';

export interface RecommendOptions {
  seed: number;
  villages: VillageInput[];
  quickRuns?: number;
  fineRuns?: number;
  topForFine?: number;
  buildHours?: number;
  onProgress?: (done: number, total: number) => void;
  /** Kembalikan true untuk membatalkan. */
  isCancelled?: () => boolean;
}

interface Eval {
  prob: Float32Array;
  meanArrival: Float32Array;
  risk: number;
  areaCells: number;
}

/** Monte Carlo ringkas: peluang, waktu tiba rata-rata, risiko berbobot, dan luas harapan. */
export function evaluate(input: SimInput, seed: number, runs: number): Eval {
  const n = input.grid.w * input.grid.h;
  const prep = prepare(input);
  const count = new Uint16Array(n);
  const sum = new Float64Array(n);
  for (let r = 0; r < runs; r++) {
    const arr = runSimulation(input, seed + r * 7919, prep).arrival;
    for (let i = 0; i < n; i++) {
      if (arr[i] >= 0) {
        count[i]++;
        sum[i] += arr[i];
      }
    }
  }
  const prob = new Float32Array(n);
  const meanArrival = new Float32Array(n).fill(-1);
  let risk = 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    if (count[i] === 0) continue;
    prob[i] = count[i] / runs;
    meanArrival[i] = sum[i] / count[i];
    risk += prob[i] * (RISK_WEIGHT[input.fuelClass[i]] ?? 1);
    area += prob[i];
  }
  return { prob, meanArrival, risk, areaCells: area };
}

function centroid(input: SimInput, cells: number[]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const c of cells) {
    sx += (c % input.grid.w) + 0.5;
    sy += Math.floor(c / input.grid.w) + 0.5;
  }
  return [sx / cells.length, sy / cells.length];
}

/** Buat kandidat garis sekat tegak lurus arah sebaran dominan. */
export function generateCandidates(input: SimInput, prob: Float32Array): FirebreakCandidate[] {
  const { w, h, cellSizeM } = input.grid;
  const origin = centroid(input, input.ignitions);
  // arah sebaran dominan: titik awal -> pusat massa sel berpeluang tinggi
  let mx = 0;
  let my = 0;
  let mw = 0;
  for (let i = 0; i < prob.length; i++) {
    if (prob[i] > 0.5) {
      mx += ((i % w) + 0.5) * prob[i];
      my += (Math.floor(i / w) + 0.5) * prob[i];
      mw += prob[i];
    }
  }
  let dx: number;
  let dy: number;
  if (mw > 0 && Math.hypot(mx / mw - origin[0], my / mw - origin[1]) > 1.5) {
    dx = mx / mw - origin[0];
    dy = my / mw - origin[1];
  } else {
    const to = (((input.windFromDeg + 180) % 360) * Math.PI) / 180;
    dx = Math.sin(to);
    dy = -Math.cos(to);
  }
  const norm = Math.hypot(dx, dy);
  dx /= norm;
  dy /= norm;

  const out: FirebreakCandidate[] = [];
  let id = 0;
  for (const dist of [6, 9, 12, 16, 20]) {
    for (const rot of [-30, 0, 30]) {
      for (const len of [10, 16, 24]) {
        for (const lateral of [-4, -2, 0, 2, 4]) {
          const r = (rot * Math.PI) / 180;
          // vektor tegak lurus d, diputar rot derajat
          const px = -dy * Math.cos(r) - dx * Math.sin(r);
          const py = dx * Math.cos(r) - dy * Math.sin(r);
          const cx = origin[0] + dx * dist + px * lateral;
          const cy = origin[1] + dy * dist + py * lateral;
          const a: [number, number] = [cx - (px * len) / 2, cy - (py * len) / 2];
          const b: [number, number] = [cx + (px * len) / 2, cy + (py * len) / 2];
          const clamp = (p: [number, number]): [number, number] => [
            Math.max(0, Math.min(w - 1, p[0])),
            Math.max(0, Math.min(h - 1, p[1])),
          ];
          const ca = clamp(a);
          const cb = clamp(b);
          const cells = rasterLine(input.grid, ca, cb, 2);
          const lengthKm = (Math.hypot(cb[0] - ca[0], cb[1] - ca[1]) * cellSizeM) / 1000;
          if (lengthKm < 1) continue;
          out.push({ id: id++, cells, a: ca, b: cb, lengthKm });
        }
      }
    }
  }
  return out;
}

function withFirebreak(input: SimInput, cells: number[]): SimInput {
  const fb = new Uint8Array(input.firebreak);
  for (const c of cells) fb[c] = 1;
  return { ...input, firebreak: fb };
}

/** Margin waktu (jam): waktu tiba api paling awal di garis dikurangi waktu bangun. */
function marginHours(input: SimInput, cells: number[], ev: Eval, buildHours: number): number {
  let first = Infinity;
  for (const c of cells) {
    if (ev.prob[c] >= 0.2 && ev.meanArrival[c] >= 0 && ev.meanArrival[c] < first) first = ev.meanArrival[c];
  }
  const totalH = (input.steps * input.stepMinutes) / 60;
  const arriveH = Number.isFinite(first) ? (first * input.stepMinutes) / 60 : totalH;
  return Math.round((arriveH - buildHours) * 10) / 10;
}

function scoreOf(eff: number, margin: number, buildHours: number, lengthKm: number): number {
  // Skor 0-100: efektivitas (penurunan risiko berbobot, 35% dianggap maksimal),
  // dikali faktor waktu (margin 3 jam dianggap aman), dikurangi biaya panjang sekat.
  // Disesuaikan dari rumus TRD agar skala skor terbaca; lihat README.
  void buildHours;
  const eff01 = Math.min(1, Math.max(0, eff) / 0.35);
  const time01 = 0.4 + 0.6 * Math.min(1, Math.max(0, margin) / 3);
  const s = 100 * eff01 * time01 - 1.5 * lengthKm;
  return Math.max(0, Math.min(100, Math.round(s * 10) / 10));
}

/**
 * Rekomendasi sekat bakar (docs/TRD.md): uji banyak kandidat, simulasikan ulang,
 * pilih 3 terbaik yang saling berjauhan minimal 1 km.
 */
export function recommendFirebreaks(input: SimInput, opts: RecommendOptions): RecommendResult {
  const quickRuns = opts.quickRuns ?? 6;
  const fineRuns = opts.fineRuns ?? 20;
  const topForFine = opts.topForFine ?? 10;
  const buildHours = opts.buildHours ?? FIREBREAK_BUILD_HOURS;
  const { seed } = opts;

  const baseFine = evaluate(input, seed, fineRuns);
  const baseQuick = evaluate(input, seed, quickRuns);
  if (baseQuick.risk <= 0) {
    return { recommendations: [], candidatesTested: 0, baselineRisk: 0, emptyReason: t('No area at risk.', 'Tidak ada area berisiko.') };
  }

  const all = generateCandidates(input, baseFine.prob);
  const valid: { cand: FirebreakCandidate; margin: number; eff: number }[] = [];
  let tested = 0;
  for (const cand of all) {
    if (opts.isCancelled?.()) break;
    tested++;
    if (tested % 10 === 0) opts.onProgress?.(tested, all.length);
    const water = cand.cells.filter((c) => input.fuelClass[c] === Fuel.WATER).length;
    if (water > cand.cells.length / 2) continue;
    const margin = marginHours(input, cand.cells, baseFine, buildHours);
    if (margin <= 0) continue;
    const ev = evaluate(withFirebreak(input, cand.cells), seed, quickRuns);
    valid.push({ cand, margin, eff: (baseQuick.risk - ev.risk) / baseQuick.risk });
  }
  opts.onProgress?.(all.length, all.length);

  if (valid.length === 0) {
    return {
      recommendations: [],
      candidatesTested: tested,
      baselineRisk: baseFine.risk,
      emptyReason: t(
        'The fire is expected to arrive before a firebreak can be built. Prioritise protecting and evacuating villages.',
        'Api diperkirakan tiba sebelum sekat sempat dibangun. Prioritaskan perlindungan dan evakuasi desa.',
      ),
    };
  }

  valid.sort((x, y) => scoreOf(y.eff, y.margin, buildHours, y.cand.lengthKm) - scoreOf(x.eff, x.margin, buildHours, x.cand.lengthKm));
  const baseRisks = villageRisks(input.grid, opts.villages, baseFine.prob, baseFine.meanArrival, input.stepMinutes);

  const fine = valid.slice(0, topForFine).map((v) => {
    const ev = evaluate(withFirebreak(input, v.cand.cells), seed, fineRuns);
    const eff = (baseFine.risk - ev.risk) / baseFine.risk;
    const risks = villageRisks(input.grid, opts.villages, ev.prob, ev.meanArrival, input.stepMinutes);
    const saved = risks.filter((r, k) => {
      const b = baseRisks[k];
      return b.etaHours !== null && (r.etaHours === null || r.etaHours - b.etaHours >= 2);
    }).length;
    const reductionPct = Math.round(((baseFine.areaCells - ev.areaCells) / baseFine.areaCells) * 1000) / 10;
    return { ...v, eff, score: scoreOf(eff, v.margin, buildHours, v.cand.lengthKm), saved, reductionPct };
  });
  fine.sort((a, b) => b.score - a.score);

  const chosen: typeof fine = [];
  const minDistCells = 1000 / input.grid.cellSizeM;
  for (const f of fine) {
    if (f.score <= 0 || f.reductionPct <= 0) continue;
    const c = [(f.cand.a[0] + f.cand.b[0]) / 2, (f.cand.a[1] + f.cand.b[1]) / 2];
    const far = chosen.every((o) => {
      const oc = [(o.cand.a[0] + o.cand.b[0]) / 2, (o.cand.a[1] + o.cand.b[1]) / 2];
      return Math.hypot(c[0] - oc[0], c[1] - oc[1]) >= minDistCells;
    });
    if (far) chosen.push(f);
    if (chosen.length === 3) break;
  }

  const labels = ['A', 'B', 'C'];
  const recommendations: FirebreakRecommendation[] = chosen.map((f, k) => {
    const dryPeat = f.cand.cells.filter(
      (c) => input.peatMoisture[c] >= 0 && input.peatMoisture[c] < input.params.peatBypassMoistureMax,
    ).length;
    const peatBypassRisk = dryPeat > f.cand.cells.length / 2;
    const fmt = (v: number) => v.toLocaleString(locale(), { maximumFractionDigits: 1 });
    let note = t(
      `Firebreak ${labels[k]} is expected to cut the burned area by ${fmt(f.reductionPct)}%, with ${fmt(f.margin)} h to spare.`,
      `Sekat ${labels[k]} diperkirakan menurunkan luas terbakar ${fmt(f.reductionPct)}%, dengan margin waktu ${fmt(f.margin)} jam.`,
    );
    if (peatBypassRisk)
      note += t(
        ' Dry peat: fire can creep under the firebreak. Add rewetting or canal blocking.',
        ' Gambut kering: api dapat merambat di bawah sekat. Sertakan pembasahan atau sekat kanal.',
      );
    return {
      rank: k + 1,
      candidateId: f.cand.id,
      cells: f.cand.cells,
      line: {
        type: 'LineString',
        coordinates: [
          gridToLonLat(input.grid, f.cand.a[0], f.cand.a[1]),
          gridToLonLat(input.grid, f.cand.b[0], f.cand.b[1]),
        ],
      },
      widthM: 2 * input.grid.cellSizeM,
      lengthKm: Math.round(f.cand.lengthKm * 100) / 100,
      score: f.score,
      reductionPct: f.reductionPct,
      marginHours: f.margin,
      villagesSaved: f.saved,
      peatBypassRisk,
      note,
    };
  });

  return {
    recommendations,
    candidatesTested: tested,
    baselineRisk: baseFine.risk,
    emptyReason:
      recommendations.length === 0
        ? t('No effective firebreak was found. Prioritise protecting and evacuating villages.', 'Tidak ditemukan sekat yang efektif. Prioritaskan perlindungan dan evakuasi desa.')
        : null,
  };
}
