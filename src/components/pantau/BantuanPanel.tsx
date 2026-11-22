'use client';

import { useEffect, useState } from 'react';
import { type BantuanResponse, HOTLINES, SERVICE_LABEL, WATER_LABEL } from '@/lib/bantuan';
import { nf } from '@/lib/format';
import { t } from '@/lib/i18n';

/** Ambil sumber air dan layanan terdekat; hasil disimpan per titik agar tidak diminta ulang. */
const cache = new Map<string, BantuanResponse>();

export function useBantuan(lat: number | null, lon: number | null) {
  const key = lat === null || lon === null ? null : `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const [state, setState] = useState<{ key: string | null; data: BantuanResponse | null }>({ key: null, data: null });

  useEffect(() => {
    if (!key || lat === null || lon === null) return;
    const hit = cache.get(key);
    let cancel = false;
    const p = hit
      ? Promise.resolve(hit)
      : fetch(`/api/bantuan?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
          .then((r) => (r.ok ? (r.json() as Promise<BantuanResponse>) : null))
          .catch(() => null);
    void p.then((d) => {
      if (cancel) return;
      if (d && d.source === 'osm') cache.set(key, d);
      setState({ key, data: d });
    });
    return () => {
      cancel = true;
    };
  }, [key, lat, lon]);

  const loading = key !== null && state.key !== key;
  return { data: state.key === key ? state.data : null, loading };
}

function Dot({ color }: { color: string }) {
  return <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

/**
 * Bagian "Bantuan terdekat" di kartu titik panas: sumber air untuk pemadaman,
 * layanan yang bisa dihubungi, dan nomor darurat nasional.
 */
export default function BantuanPanel({ data, loading }: { data: BantuanResponse | null; loading: boolean }) {
  const [all, setAll] = useState(false);
  const water = data?.water ?? [];
  const services = data?.services ?? [];
  const shownServices = all ? services : services.slice(0, 4);

  return (
    <section aria-label={t('Help nearby', 'Bantuan terdekat')} className="mt-4 space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{t('Nearest water sources', 'Sumber air terdekat')}</p>
        {loading ? (
          <div className="skeleton mt-2 h-14 rounded-[12px]" />
        ) : water.length ? (
          <ul className="mt-1.5 divide-y divide-line rounded-[12px] bg-black/20">
            {water.slice(0, 4).map((w) => (
              <li key={w.id} className="flex gap-2.5 px-3 py-2 text-sm">
                <Dot color="#4fb8f0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{w.name || WATER_LABEL[w.kind]}</span>
                  <span className="text-xs text-ink-3">{WATER_LABEL[w.kind]}</span>
                </span>
                <span className="num shrink-0 text-sm font-semibold text-ink">{nf(w.distanceKm)} km</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 rounded-[12px] bg-black/20 px-3 py-2 text-[13px] leading-5 text-ink-2">
            {data?.source === 'none' ? t('The OpenStreetMap server is busy. The emergency numbers below still work.', 'Server OpenStreetMap sedang penuh. Nomor darurat di bawah tetap bisa dipakai.') : t('No river, canal or pond is mapped in OpenStreetMap within 10 km.', 'Tidak ada sungai, kanal, atau embung tercatat di OpenStreetMap dalam radius 10 km.')}
          </p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{t('Nearest services', 'Layanan terdekat')}</p>
        {loading ? (
          <div className="skeleton mt-2 h-14 rounded-[12px]" />
        ) : services.length ? (
          <>
            <ul className="mt-1.5 divide-y divide-line rounded-[12px] bg-black/20">
              {shownServices.map((s) => (
                <li key={s.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{s.name || SERVICE_LABEL[s.kind]}</span>
                    <span className="num text-xs text-ink-3">
                      {SERVICE_LABEL[s.kind]} · {nf(s.distanceKm)} km
                    </span>
                  </span>
                  {s.phone ? (
                    <a
                      href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}
                      className="grad-sun shrink-0 rounded-full px-3 py-1.5 text-xs font-bold hover:brightness-105"
                    >
                      {t('Call', 'Telepon')}
                    </a>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-white/10"
                    >
                      {t('Route', 'Rute')}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {services.length > 4 && (
              <button onClick={() => setAll(!all)} className="mt-1 text-xs font-semibold text-sun hover:underline">
                {all ? t('Show fewer', 'Tampilkan lebih sedikit') : t(`Show all (${services.length})`, `Tampilkan semua (${services.length})`)}
              </button>
            )}
          </>
        ) : (
          <p className="mt-1.5 rounded-[12px] bg-black/20 px-3 py-2 text-[13px] leading-5 text-ink-2">
            {t('No service office is mapped in OpenStreetMap within 30 km. Use the emergency numbers below.', 'Belum ada kantor layanan tercatat di OpenStreetMap dalam radius 30 km. Pakai nomor darurat di bawah.')}
          </p>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{t('Emergency numbers', 'Nomor darurat')}</p>
        <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
          {HOTLINES.map((h) => (
            <li key={h.number}>
              <a
                href={`tel:${h.number}`}
                title={h.hint}
                className="flex items-center gap-2 rounded-[12px] bg-black/20 px-3 py-2 hover:bg-white/10"
              >
                <span className="num text-lg font-bold text-sun">{h.number}</span>
                <span className="text-xs leading-4 text-ink-2">{h.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] leading-4 text-ink-3">
          {t('Local BPBD and Manggala Agni can be reached through 112. Water and service data from OpenStreetMap; straight-line distance.', 'BPBD dan Manggala Agni setempat bisa dihubungi lewat 112. Data air dan layanan dari OpenStreetMap; jarak garis lurus.')}
        </p>
      </div>
    </section>
  );
}
