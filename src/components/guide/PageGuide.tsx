'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/components/i18n/LangProvider';
import { IconArrowLeft, IconArrowRight, IconClose, IconInfo } from '@/components/ui/icons';
import { Button } from '@/components/ui/primitives';

export interface GuideStep {
  art: ReactNode;
  title: string;
  body: string;
}

const key = (id: string) => `apirimba:guide:${id}`;

function seen(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) === '1';
  } catch {
    return true; // tanpa penyimpanan: jangan memaksa panduan terbuka terus
  }
}
function markSeen(id: string) {
  try {
    localStorage.setItem(key(id), '1');
  } catch {
    // abaikan
  }
}

/**
 * Panduan langkah demi langkah per halaman: terbuka otomatis pada kunjungan pertama,
 * lalu bisa dibuka lagi kapan saja lewat tombol "Panduan".
 */
export default function PageGuide({
  id,
  title,
  steps,
  buttonClassName = 'fixed bottom-5 left-5 z-[60]',
  auto = true,
}: {
  id: string;
  title: string;
  steps: GuideStep[];
  buttonClassName?: string;
  auto?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!auto || seen(id)) return;
    const timer = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(timer);
  }, [auto, id]);

  const close = useCallback(() => {
    markSeen(id);
    setOpen(false);
    setI(0);
  }, [id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setI((v) => Math.min(steps.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, steps.length]);

  const step = steps[i];
  const last = i === steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`no-print glass inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-ink shadow-float hover:bg-white/10 ${buttonClassName}`}
        aria-label={t('Open the guide for this page', 'Buka panduan halaman ini')}
      >
        <IconInfo size={16} /> {t('Guide', 'Panduan')}
      </button>

      {open && step && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1000] grid place-items-end bg-black/65 p-2 sm:place-items-center sm:p-6"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <div role="dialog" aria-modal="true" aria-label={title} className="glass max-h-[calc(100dvh-16px)] w-full max-w-[480px] overflow-y-auto rounded-[24px] shadow-float sm:max-h-[calc(100dvh-48px)]">
            <div className="relative">
              <div className="aspect-[4/3] max-h-[42dvh] w-full overflow-hidden">{step.art}</div>
              <button
                onClick={close}
                aria-label={t('Close guide', 'Tutup panduan')}
                className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <IconClose size={16} />
              </button>
              <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">{title}</span>
            </div>
            <div className="p-5">
              <p className="num text-xs font-semibold text-sun">
                {t('Step', 'Langkah')} {i + 1} / {steps.length}
              </p>
              <h2 className="mt-1 text-xl font-bold leading-tight text-ink">{step.title}</h2>
              <p className="mt-2 text-[15px] leading-7 text-ink-2">{step.body}</p>
              <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
                {steps.map((s, k) => (
                  <button
                    key={s.title}
                    tabIndex={-1}
                    onClick={() => setI(k)}
                    className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-sun' : 'w-1.5 bg-white/25 hover:bg-white/50'}`}
                  />
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between gap-2">
                <button onClick={close} className="text-sm font-semibold text-ink-3 hover:text-ink">
                  {t('Skip', 'Lewati')}
                </button>
                <div className="flex gap-2">
                  {i > 0 && (
                    <Button variant="secondary" onClick={() => setI(i - 1)} aria-label={t('Previous step', 'Langkah sebelumnya')}>
                      <IconArrowLeft size={16} />
                    </Button>
                  )}
                  <Button onClick={() => (last ? close() : setI(i + 1))}>
                    {last ? t('Got it', 'Mengerti') : t('Next', 'Lanjut')} {!last && <IconArrowRight size={16} />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
