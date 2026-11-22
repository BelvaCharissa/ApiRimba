import { describe, expect, it } from 'vitest';
import { arrivalWeights, CO2_T_PER_HA, estimateCarbon } from '@/lib/sim/carbon';
import { Fuel } from '@/lib/sim/types';

describe('estimateCarbon (perkiraan emisi CO2)', () => {
  it('menghitung gambut 600 t CO2/ha per sel terbakar penuh', () => {
    // sel 100 m = 1 ha
    const r = estimateCarbon([Fuel.PEAT], [1], 100);
    expect(r.tCO2).toBeCloseTo(600);
    expect(r.peatShare).toBe(1);
    expect(r.peatHa).toBeCloseTo(1);
  });

  it('membobot dengan peluang terbakar dan mengabaikan air serta permukiman', () => {
    const fuel = [Fuel.PRIMARY_FOREST, Fuel.WATER, Fuel.SETTLEMENT, Fuel.PEAT];
    const r = estimateCarbon(fuel, [0.5, 1, 1, 0], 100);
    expect(r.tCO2).toBeCloseTo(CO2_T_PER_HA[Fuel.PRIMARY_FOREST] * 0.5);
    expect(r.peatShare).toBe(0);
  });

  it('nol bila tidak ada yang terbakar', () => {
    expect(estimateCarbon([Fuel.PEAT, Fuel.SHRUB], [0, 0], 250).tCO2).toBe(0);
  });

  it('arrivalWeights hanya menghitung sel yang tiba dalam batas langkah', () => {
    const w = arrivalWeights(Int16Array.from([-1, 0, 48, 49]), 48);
    expect(Array.from(w)).toEqual([0, 1, 1, 0]);
  });
});
