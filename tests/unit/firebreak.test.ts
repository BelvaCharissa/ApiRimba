import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ScenarioData } from '@/lib/scenario';
import { evaluate, recommendFirebreaks } from '@/lib/sim/firebreak';
import { buildSimInput } from '@/lib/sim/input';
import { DEFAULT_SEED } from '@/lib/sim/params';

const load = (slug: string): ScenarioData =>
  JSON.parse(readFileSync(join(__dirname, `../../public/data/scenarios/${slug}.json`), 'utf8'));

describe.each(['riau', 'kalteng', 'sumsel'])('rekomendasi sekat bakar: %s', (slug) => {
  const data = load(slug);
  const input = buildSimInput(data, { windMs: data.defaultWindMs, windFromDeg: data.defaultWindFromDeg });
  const t0 = performance.now();
  const res = recommendFirebreaks(input, { seed: DEFAULT_SEED, villages: data.villages });
  const ms = performance.now() - t0;

  it('menghasilkan 1-3 rekomendasi dalam < 5 detik', () => {
    console.log(
      `${slug}: ${res.candidatesTested} kandidat, ${ms.toFixed(0)} ms ->`,
      res.recommendations.map((r) => `skor ${r.score} turun ${r.reductionPct}% margin ${r.marginHours}j desa ${r.villagesSaved}`),
    );
    expect(res.recommendations.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(5000);
  });

  it('semua rekomendasi punya margin waktu positif', () => {
    for (const r of res.recommendations) expect(r.marginHours).toBeGreaterThan(0);
  });

  it('rekomendasi saling berjarak minimal 1 km', () => {
    const mid = (r: (typeof res.recommendations)[number]) => {
      const [a, b] = r.line.coordinates;
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    };
    const recs = res.recommendations;
    for (let i = 0; i < recs.length; i++) {
      for (let j = i + 1; j < recs.length; j++) {
        const [x1, y1] = mid(recs[i]);
        const [x2, y2] = mid(recs[j]);
        const km = Math.hypot((x1 - x2) * 111.32 * Math.cos((y1 * Math.PI) / 180), (y1 - y2) * 111.32);
        expect(km).toBeGreaterThanOrEqual(0.99);
      }
    }
  });

  it('menerapkan sekat terbaik menurunkan luas terbakar rata-rata', () => {
    const best = res.recommendations[0];
    const base = evaluate(input, DEFAULT_SEED, 20);
    const fb = new Uint8Array(input.firebreak);
    for (const c of best.cells) fb[c] = 1;
    const after = evaluate({ ...input, firebreak: fb }, DEFAULT_SEED, 20);
    expect(after.areaCells).toBeLessThan(base.areaCells);
  });

  it('hasil deterministik', () => {
    const again = recommendFirebreaks(input, { seed: DEFAULT_SEED, villages: data.villages });
    expect(again.recommendations.map((r) => r.candidateId)).toEqual(res.recommendations.map((r) => r.candidateId));
  });
});
