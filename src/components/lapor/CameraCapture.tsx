'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { IconCamera, IconClose } from '@/components/ui/icons';
import { Button } from '@/components/ui/primitives';

/**
 * Kamera langsung di aplikasi (getUserMedia, kamera belakang). Foto yang diambil di sini pasti baru,
 * jadi waktu dan lokasinya bisa dipercaya lebih dari foto galeri.
 */
export default function CameraCapture({ onCapture, onClose }: { onCapture: (frame: HTMLCanvasElement) => void; onClose: () => void }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'starting' | 'ready' | 'denied'>('starting');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false });
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => undefined);
        }
        setState('ready');
      } catch {
        setState('denied');
      }
    })();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      stopped = true;
      stream?.getTracks().forEach((tr) => tr.stop());
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    onCapture(c);
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={t('Camera', 'Kamera')}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-semibold">{t('Point the camera at the fire or smoke', 'Arahkan kamera ke api atau asap')}</p>
        <button onClick={onClose} aria-label={t('Close camera', 'Tutup kamera')} className="grid size-10 place-items-center rounded-full hover:bg-white/10">
          <IconClose size={20} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={video} playsInline muted className="absolute inset-0 size-full object-contain" />
        {state === 'starting' && <p className="absolute inset-0 grid place-items-center text-sm text-white/70">{t('Starting the camera...', 'Menyalakan kamera...')}</p>}
        {state === 'denied' && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div>
              <p className="font-semibold">{t('Camera access is blocked.', 'Akses kamera diblokir.')}</p>
              <p className="mt-1 text-sm text-white/70">
                {t('Allow the camera in your browser settings, or close this and choose a photo from the gallery.', 'Izinkan kamera di pengaturan browser, atau tutup ini lalu pilih foto dari galeri.')}
              </p>
              <Button className="mt-4" onClick={onClose}>
                {t('Close', 'Tutup')}
              </Button>
            </div>
          </div>
        )}
        {/* bingkai bidik */}
        {state === 'ready' && <div className="pointer-events-none absolute inset-6 rounded-[24px] border-2 border-white/40" aria-hidden="true" />}
      </div>
      <div className="flex items-center justify-center gap-3 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
        <button
          onClick={shoot}
          disabled={state !== 'ready'}
          aria-label={t('Take photo', 'Ambil foto')}
          className="grad-fire grid size-[72px] place-items-center rounded-full text-white ring-4 ring-white/30 disabled:opacity-40"
        >
          <IconCamera size={30} />
        </button>
      </div>
    </div>
  );
}
