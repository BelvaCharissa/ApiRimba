'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { Button } from './primitives';

export default function ShareQr({ url, label }: { url: string; label?: string }) {
  const t = useT();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 180, margin: 1, color: { dark: '#0b1d15', light: '#fffaf0' } })
      .then((value) => alive && setQr(value))
      .catch(() => alive && setQr(null));
    return () => { alive = false; };
  }, [url]);

  const share = async () => {
    const text = label ?? t('ApiRimba danger area', 'Area bahaya ApiRimba');
    try {
      if (navigator.share) await navigator.share({ title: text, text, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled or browser denied sharing.
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-center">
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={t('QR code to open this link', 'Kode QR untuk membuka tautan ini')} className="mx-auto size-[180px] rounded-[12px] bg-[#fffaf0] p-2" />
      )}
      <div>
        <p className="text-sm font-semibold text-ink">{label ?? t('Share this area', 'Bagikan area ini')}</p>
        <p className="mt-1 break-all text-xs leading-5 text-ink-3">{url}</p>
        <Button size="sm" className="mt-3" onClick={share}>
          {copied ? t('Link copied', 'Tautan tersalin') : t('Share or copy link', 'Bagikan atau salin tautan')}
        </Button>
      </div>
    </div>
  );
}
