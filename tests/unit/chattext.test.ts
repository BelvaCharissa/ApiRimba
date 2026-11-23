import { describe, expect, it } from 'vitest';
import { parseBlocks } from '@/components/chat/ChatText';

describe('parseBlocks (format jawaban asisten)', () => {
  it('memisahkan paragraf, poin, dan langkah bernomor', () => {
    const b = parseBlocks('Buka /lapor.\n1. Ambil foto.\n2. Tandai lokasi.\n- Dicek AI.\n* Dicek petugas.');
    expect(b).toEqual([
      { kind: 'p', text: 'Buka /lapor.' },
      { kind: 'ol', items: ['Ambil foto.', 'Tandai lokasi.'] },
      { kind: 'ul', items: ['Dicek AI.', 'Dicek petugas.'] },
    ]);
  });

  it('mengabaikan baris kosong dan tanda judul markdown', () => {
    expect(parseBlocks('## Judul\n\n\nIsi')).toEqual([
      { kind: 'p', text: 'Judul' },
      { kind: 'p', text: 'Isi' },
    ]);
  });
});
