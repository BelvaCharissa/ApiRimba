/** Alat bantu menala parameter: npx tsx scripts/tune.ts */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScenarioData } from '../src/lib/scenario';
import { runMonteCarlo } from '../src/lib/sim/engine';
import { buildSimInput } from '../src/lib/sim/input';
import { DEFAULT_SEED } from '../src/lib/sim/params';
import { villageRisks } from '../src/lib/sim/risk';
import type { SimParams } from '../src/lib/sim/types';

const slugs = ['riau', 'kalteng', 'sumsel'];
const overrides: Partial<SimParams> = JSON.parse(process.argv[2] ?? '{}');

for (const slug of slugs) {
  const d: ScenarioData = JSON.parse(readFileSync(join(__dirname, `../public/data/scenarios/${slug}.json`), 'utf8'));
  for (const [ms, from] of [
    [d.defaultWindMs, d.defaultWindFromDeg],
    [d.defaultWindMs, (d.defaultWindFromDeg + 90) % 360],
    [12, d.defaultWindFromDeg],
    [2, d.defaultWindFromDeg],
  ]) {
    const inp = buildSimInput(d, { windMs: ms, windFromDeg: from, params: overrides });
    const t0 = performance.now();
    const mc = runMonteCarlo(inp, DEFAULT_SEED, 12);
    const ms2 = performance.now() - t0;
    const area = (mc.prob.reduce((s, v) => s + v, 0) * 0.0625).toFixed(1);
    const vr = villageRisks(d.grid, d.villages, mc.prob, mc.meanArrival, 15)
      .map((v) => `${v.villageName.split(' ')[0]}:${v.etaHours ?? '-'}`)
      .join(' ');
    console.log(`${slug} ${ms}m/s dari ${from}: ${area} km2 (${ms2.toFixed(0)}ms) | ${vr}`);
  }
}
