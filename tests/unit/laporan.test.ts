import { describe, expect, it } from 'vitest';
import { pledgeStatusLabel, pledgeStepIndex } from '@/lib/aid';
import { isClearlyNotFire, parseCheck } from '@/lib/vision';
import { stampTime, zoneOf } from '@/lib/watermark';

describe('pemeriksaan foto oleh AI', () => {
  it('mengurai jawaban JSON model, juga bila dibungkus teks', () => {
    expect(parseCheck('{"label":"smoke","confidence":0.82,"reason":"Asap tebal di atas kebun."}')).toEqual({
      label: 'smoke',
      confidence: 0.82,
      reason: 'Asap tebal di atas kebun.',
    });
    expect(parseCheck('```json\n{"label":"fire","confidence":1.4}\n```')).toEqual({ label: 'fire', confidence: 1, reason: '' });
  });

  it('menolak label yang tidak dikenal atau JSON rusak', () => {
    expect(parseCheck('{"label":"cat"}')).toBeNull();
    expect(parseCheck('bukan json')).toBeNull();
  });

  it('hanya menolak foto bila AI yakin tidak ada api', () => {
    const base = { reason: '', model: 'x' };
    expect(isClearlyNotFire({ ...base, label: 'none', confidence: 0.9 })).toBe(true);
    expect(isClearlyNotFire({ ...base, label: 'none', confidence: 0.5 })).toBe(false);
    expect(isClearlyNotFire({ ...base, label: 'unclear', confidence: 0.9 })).toBe(false);
    expect(isClearlyNotFire(null)).toBe(false);
  });
});

describe('watermark foto', () => {
  it('memilih zona waktu dari provinsi', () => {
    expect(zoneOf('Riau').label).toBe('WIB');
    expect(zoneOf('Kalimantan Timur').label).toBe('WITA');
    expect(zoneOf('Sulawesi Tengah').label).toBe('WITA');
    expect(zoneOf('Papua Selatan').label).toBe('WIT');
    expect(zoneOf(null).label).toBe('WIB');
  });

  it('mencetak jam sesuai zona', () => {
    const d = new Date('2026-11-22T08:47:00Z');
    expect(stampTime(d, 'Riau')).toMatch(/15[.:]47 WIB$/);
    expect(stampTime(d, 'Bali')).toMatch(/16[.:]47 WITA$/);
  });
});

describe('status penyaluran bantuan', () => {
  it('mengurutkan tahap dari dijanjikan sampai disalurkan', () => {
    expect(pledgeStepIndex('pledged')).toBe(0);
    expect(pledgeStepIndex('distributed')).toBe(4);
    expect(pledgeStepIndex('cancelled')).toBe(-1);
    expect(pledgeStatusLabel('received')).toBe('Diterima posko');
  });
});
