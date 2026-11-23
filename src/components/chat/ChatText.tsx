'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/** Halaman yang boleh menjadi tautan di jawaban AI (selain ini tetap teks biasa). */
const PAGES = ['/peta', '/lapor', '/bantu', '/cara-kerja', '/petugas', '/admin', '/akun', '/masuk', '/daftar'];
const INLINE = /(\*\*[^*\n]+\*\*|\/(?:peta|lapor|bantu|cara-kerja|petugas|admin|akun|masuk|daftar)\b)/g;

type Block = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] };

/** Pecah teks jadi paragraf, daftar poin ("- ", "* ", "• "), dan daftar bernomor ("1. "). */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^(?:[-*•])\s+(.*)$/);
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    const kind = bullet ? 'ul' : num ? 'ol' : 'p';
    const body = (bullet?.[1] ?? num?.[1] ?? line).replace(/^#+\s*/, '');
    const prev = blocks[blocks.length - 1];
    if (kind === 'p') blocks.push({ kind: 'p', text: body });
    else if (prev && prev.kind === kind) prev.items.push(body);
    else blocks.push({ kind, items: [body] });
  }
  return blocks;
}

/** **tebal** dan /halaman menjadi elemen React; sisanya teks biasa (tidak ada HTML mentah). */
function inline(text: string, onNavigate?: () => void): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2).trim();
      if (PAGES.includes(inner)) {
        return (
          <Link key={i} href={inner} onClick={onNavigate} className="font-semibold text-sun underline underline-offset-2 hover:no-underline">
            {inner}
          </Link>
        );
      }
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (PAGES.includes(part)) {
      return (
        <Link key={i} href={part} onClick={onNavigate} className="font-semibold text-sun underline underline-offset-2 hover:no-underline">
          {part}
        </Link>
      );
    }
    return part.replace(/\*\*/g, '');
  });
}

/** Jawaban asisten yang rapi: paragraf singkat, poin, dan langkah bernomor. */
export default function ChatText({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>{inline(b.text, onNavigate)}</p>
        ) : b.kind === 'ul' ? (
          <ul key={i} className="space-y-1">
            {b.items.map((it, k) => (
              <li key={k} className="flex gap-2">
                <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-leaf" />
                <span>{inline(it, onNavigate)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="space-y-1">
            {b.items.map((it, k) => (
              <li key={k} className="flex gap-2">
                <span className="num mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-ink">{k + 1}</span>
                <span>{inline(it, onNavigate)}</span>
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
