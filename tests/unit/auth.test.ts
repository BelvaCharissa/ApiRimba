import { describe, expect, it } from 'vitest';
import { passwordProblem } from '@/components/auth/authError';
import { safeNext } from '@/lib/safe-next';

const t = (_en: string, id: string) => id;

describe('safeNext (tujuan setelah masuk)', () => {
  it('menerima jalur internal', () => {
    expect(safeNext('/petugas')).toBe('/petugas');
    expect(safeNext('/bantu?kode=AR-123ABC')).toBe('/bantu?kode=AR-123ABC');
  });

  it('menolak alamat luar dan trik open redirect', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'evil.com', '/akun\r\nSet-Cookie: x=1']) {
      expect(safeNext(bad)).toBe('/akun');
    }
  });

  it('memakai cadangan bila kosong', () => {
    expect(safeNext(null)).toBe('/akun');
    expect(safeNext('', '/')).toBe('/');
  });
});

describe('passwordProblem (aturan sandi)', () => {
  it('menolak sandi pendek atau tanpa angka/huruf', () => {
    expect(passwordProblem('abc12', t)).not.toBe('');
    expect(passwordProblem('abcdefgh', t)).not.toBe('');
    expect(passwordProblem('12345678', t)).not.toBe('');
  });

  it('menerima sandi 8+ karakter berisi huruf dan angka', () => {
    expect(passwordProblem('gambut2026', t)).toBe('');
  });
});
