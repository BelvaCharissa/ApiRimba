'use client';

import { usePathname } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useLang } from '@/components/i18n/LangProvider';
import { IconChat, IconClose, IconSend } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/primitives';

interface Msg {
  role: 'user' | 'model';
  text: string;
}

const STORE = 'apirimba-chat';

/**
 * Asisten di sisi kanan semua halaman. Bertanya soal titik panas hari ini, cara membaca peta,
 * cara melapor, atau cara menyalurkan bantuan. Riwayat disimpan di browser ini saja.
 */
export default function ChatWidget() {
  const { lang, t } = useLang();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = sessionStorage.getItem(STORE);
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-20)));
    } catch {
      // abaikan
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', text: q }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, page: path, messages: next.slice(-12) }),
      });
      const json = (await res.json()) as { text?: string };
      setMsgs([...next, { role: 'model', text: json.text ?? t('Something went wrong. Please try again.', 'Terjadi kesalahan. Coba lagi.') }]);
    } catch {
      setMsgs([...next, { role: 'model', text: t('No connection. Please try again.', 'Tidak ada koneksi. Coba lagi.') }]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const suggestions = [
    t('Where are the worst fires today?', 'Di mana kebakaran terparah hari ini?'),
    t('How do I report a fire?', 'Bagaimana cara melapor kebakaran?'),
    t('What aid is needed most?', 'Bantuan apa yang paling dibutuhkan?'),
    t('How do I read the map?', 'Bagaimana cara membaca peta?'),
  ];

  // laporan cetak: tidak perlu tombol chat
  if (path.startsWith('/report')) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="no-print grad-sun fixed bottom-20 right-4 z-[60] flex h-12 items-center gap-2 rounded-full px-5 text-sm font-bold shadow-float hover:brightness-105 sm:bottom-20 sm:right-5"
          aria-label={t('Ask the ApiRimba assistant', 'Tanya asisten ApiRimba')}
        >
          <IconChat size={18} /> {t('Ask AI', 'Tanya AI')}
        </button>
      )}

      {open && (
        <aside
          role="dialog"
          aria-label={t('ApiRimba assistant', 'Asisten ApiRimba')}
          className="no-print glass fixed inset-x-2 bottom-2 top-16 z-[70] flex flex-col overflow-hidden rounded-[24px] shadow-float sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[400px]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink">{t('ApiRimba assistant', 'Asisten ApiRimba')}</p>
              <p className="text-xs leading-5 text-ink-3">
                {t('Knows today’s satellite hotspots and how the app works. Not a dispatcher.', 'Tahu titik panas satelit hari ini dan cara kerja aplikasi. Bukan petugas pengerahan.')}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={t('Close assistant', 'Tutup asisten')}
              className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/10 hover:text-ink"
            >
              <IconClose size={18} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.length === 0 && (
              <div>
                <p className="text-sm leading-6 text-ink-2">
                  {t(
                    'Ask about fires near a place, how to read the map, how to report, or where to send aid.',
                    'Tanyakan soal api di dekat suatu tempat, cara membaca peta, cara melapor, atau ke mana menyalurkan bantuan.',
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="rounded-full border border-line-strong px-3 py-1.5 text-left text-xs font-semibold text-ink hover:bg-white/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 text-sm leading-6 ${
                    m.role === 'user' ? 'grad-sun rounded-br-[4px]' : 'rounded-bl-[4px] bg-black/30 text-ink'
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ))}
            {busy && (
              <p className="flex items-center gap-2 text-xs text-ink-3">
                <Spinner size={14} /> {t('Thinking...', 'Sedang berpikir...')}
              </p>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-line p-3">
            <div className="flex items-end gap-2 rounded-[16px] bg-black/25 p-1.5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder={t('Type a question...', 'Ketik pertanyaan...')}
                aria-label={t('Your question', 'Pertanyaan Anda')}
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label={t('Send', 'Kirim')}
                className="grad-sun grid size-10 shrink-0 place-items-center rounded-full disabled:opacity-40"
              >
                <IconSend size={17} />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] leading-4 text-ink-3">
              {t('In an emergency call 112 or 113. Answers can be wrong.', 'Dalam keadaan darurat hubungi 112 atau 113. Jawaban bisa keliru.')}
            </p>
          </form>
        </aside>
      )}
    </>
  );
}
