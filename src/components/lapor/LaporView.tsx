'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { IconCamera, IconCheck, IconPin } from '@/components/ui/icons';
import { Button, Spinner } from '@/components/ui/primitives';
import SiteFooter from '@/components/ui/SiteFooter';
import SiteHeader from '@/components/ui/SiteHeader';
import { HOTLINES } from '@/lib/bantuan';
import { locale } from '@/lib/i18n';
import ReportList, { type PublicReport, StatusPill } from './ReportList';

const LocationPicker = dynamic(() => import('./LocationPicker'), { ssr: false, loading: () => <div className="skeleton h-[320px] rounded-[16px]" /> });

type Category = PublicReport['category'];

interface Result {
  id: string;
  status: 'matched' | 'pending';
  satelliteKm: number | null;
  exifKm: number | null;
  exifTakenAt: string | null;
  hasExifGps: boolean;
}

const MAX = 8 * 1024 * 1024;

export default function LaporView() {
  const t = useT();
  const params = useSearchParams();
  const pre = params.get('lokasi')?.split(',').map(Number);
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(pre && pre.length === 2 && pre.every(Number.isFinite) ? { lat: pre[0], lon: pre[1] } : null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<Category>('fire');
  const [desc, setDesc] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [geoState, setGeoState] = useState<'idle' | 'busy' | 'denied'>('idle');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [reports, setReports] = useState<PublicReport[] | null>(null);

  const loadReports = useCallback(() => {
    fetch('/api/lapor')
      .then((r) => r.json() as Promise<{ reports: PublicReport[] }>)
      .then((d) => setReports(d.reports))
      .catch(() => setReports([]));
  }, []);
  useEffect(loadReports, [loadReports]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const useGps = () => {
    if (!navigator.geolocation) return setGeoState('denied');
    setGeoState('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude });
        setGeoState('idle');
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const fileErr = file && file.size > MAX ? t('The photo must be 8 MB or smaller.', 'Foto maksimal 8 MB.') : '';
  const ready = !!file && !fileErr && !!pos && desc.trim().length >= 10;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || !file || !pos) return;
    setState('busy');
    setErrMsg('');
    const fd = new FormData();
    fd.set('photo', file);
    fd.set('lat', String(pos.lat));
    fd.set('lon', String(pos.lon));
    fd.set('category', category);
    fd.set('description', desc.trim());
    if (name) fd.set('name', name);
    if (contact) fd.set('contact', contact);
    try {
      const res = await fetch('/api/lapor', { method: 'POST', body: fd });
      const json = (await res.json()) as Result & { error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? 'error');
      setResult(json);
      setState('idle');
      loadReports();
    } catch (er) {
      setErrMsg(er instanceof Error && er.message !== 'error' ? er.message : '');
      setState('error');
    }
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    setDesc('');
  };

  const points = useMemo(() => (reports ?? []).map((r) => ({ lat: r.lat, lon: r.lon, kind: 'report' as const })), [reports]);
  const cats: { key: Category; label: string; hint: string }[] = [
    { key: 'fire', label: t('Open fire', 'Api terlihat'), hint: t('Flames are visible', 'Nyala api terlihat') },
    { key: 'smoke', label: t('Smoke only', 'Asap saja'), hint: t('Smoke rising, no flames seen', 'Asap naik, api tidak terlihat') },
    { key: 'burnt', label: t('Burnt area', 'Bekas terbakar'), hint: t('Black ground, may still smoulder', 'Tanah hitam, bisa masih membara') },
  ];
  const field = 'mt-1.5 w-full rounded-[12px] border border-line-strong bg-black/25 px-3 text-ink placeholder:text-ink-3 focus:border-sun focus:outline-none';

  return (
    <div className="min-h-dvh bg-paper">
      <div className="grad-canopy">
        <SiteHeader cta={false} />
        <section className="mx-auto max-w-[1200px] px-4 pb-12 pt-10 sm:px-6">
          <p className="text-sm font-semibold text-[#ff9a5c]">{t('Report a fire', 'Lapor api')}</p>
          <h1 className="mt-2 max-w-[760px] text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {t('Seen fire or smoke? Send a photo.', 'Melihat api atau asap? Kirim fotonya.')}
          </h1>
          <p className="mt-4 max-w-[640px] text-lg leading-8 text-ink-2">
            {t(
              'Satellites miss small fires and fires under thick smoke. Your report fills the gap. Every report needs a photo and is checked against satellite data before it is shown as matched.',
              'Satelit melewatkan api kecil dan api di bawah asap tebal. Laporan Anda mengisi celah itu. Setiap laporan wajib foto dan dicocokkan dengan data satelit sebelum ditandai cocok.',
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {HOTLINES.slice(0, 2).map((h) => (
              <a key={h.number} href={`tel:${h.number}`} className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-ink hover:bg-white/10">
                <b className="num text-sun">{h.number}</b> {h.number === '112' ? t('Emergency', 'Darurat') : t('Fire brigade', 'Pemadam kebakaran')}
              </a>
            ))}
            <span className="self-center text-xs text-ink-3">{t('Life in danger? Call first, report after.', 'Nyawa terancam? Telepon dulu, lapor kemudian.')}</span>
          </div>
        </section>
      </div>

      <div className="grad-canopy-soft">
        <section className="mx-auto grid max-w-[1200px] gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
          {result ? (
            <div className="glass rounded-[24px] p-6">
              <span className="grad-sun grid size-12 place-items-center rounded-full">
                <IconCheck size={22} />
              </span>
              <h2 className="mt-4 text-2xl font-bold text-ink">{t('Report received', 'Laporan diterima')}</h2>
              <div className="mt-2">
                <StatusPill status={result.status} />
              </div>
              <ul className="mt-5 space-y-2 text-sm text-ink-2">
                <li className="flex gap-2">
                  <IconCheck size={16} className="mt-0.5 shrink-0 text-ok" /> {t('Photo checked: it is a real image file.', 'Foto diperiksa: benar file gambar.')}
                </li>
                <li className="flex gap-2">
                  <IconCheck size={16} className="mt-0.5 shrink-0 text-ok" />
                  {result.satelliteKm !== null
                    ? t(
                        `Nearest NASA FIRMS hotspot (48 h): ${result.satelliteKm.toLocaleString(locale())} km from your location.`,
                        `Titik panas NASA FIRMS terdekat (48 jam): ${result.satelliteKm.toLocaleString(locale())} km dari lokasi Anda.`,
                      )
                    : t('No satellite hotspot nearby in the last 48 h. An officer will review it.', 'Tidak ada titik panas satelit di dekatnya dalam 48 jam. Petugas akan meninjaunya.')}
                </li>
                <li className="flex gap-2">
                  <IconCheck size={16} className="mt-0.5 shrink-0 text-ok" />
                  {result.hasExifGps && result.exifKm !== null
                    ? t(`Photo GPS is ${result.exifKm.toLocaleString(locale())} km from the reported location.`, `GPS foto berjarak ${result.exifKm.toLocaleString(locale())} km dari lokasi laporan.`)
                    : t('The photo has no GPS data (common when sent through chat apps).', 'Foto tidak punya data GPS (biasa terjadi bila dikirim lewat aplikasi chat).')}
                </li>
              </ul>
              <p className="mt-5 text-sm leading-6 text-ink-3">
                {t(
                  '"Matched" means a satellite hotspot or the photo GPS is within 5 km. Other reports stay visible as "Waiting for review" until an officer checks them.',
                  '"Cocok" berarti titik panas satelit atau GPS foto berada dalam 5 km. Laporan lain tetap tampil sebagai "Menunggu tinjauan" sampai petugas memeriksanya.',
                )}
              </p>
              <Button className="mt-6" onClick={reset}>
                {t('Send another report', 'Kirim laporan lain')}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="glass space-y-5 rounded-[24px] p-5 sm:p-6" noValidate>
              <h2 className="text-xl font-bold text-ink">{t('Your report', 'Laporan Anda')}</h2>

              {/* 1. foto */}
              <div>
                <p className="text-sm font-semibold text-ink">
                  1. {t('Photo', 'Foto')} <span className="text-[#ff9a5c]">*</span>
                </p>
                <label className="mt-2 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[16px] border-2 border-dashed border-line-strong bg-black/20 p-4 text-center hover:bg-white/5">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt={t('Selected photo', 'Foto terpilih')} className="max-h-64 rounded-[10px] object-contain" />
                  ) : (
                    <>
                      <IconCamera size={28} className="text-ink-2" />
                      <span className="text-sm font-semibold text-ink">{t('Take or choose a photo', 'Ambil atau pilih foto')}</span>
                      <span className="text-xs text-ink-3">JPEG, PNG, WebP · {t('max', 'maks')} 8 MB</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {fileErr && <p className="mt-1 text-sm text-danger-ink">{fileErr}</p>}
                <p className="mt-1.5 text-xs leading-5 text-ink-3">
                  {t(
                    'Take it on the spot with the camera if you can: the photo’s GPS and time help verify the report. Avoid showing faces.',
                    'Ambil langsung dengan kamera bila bisa: GPS dan waktu foto membantu verifikasi. Hindari memotret wajah orang.',
                  )}
                </p>
              </div>

              {/* 2. lokasi */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    2. {t('Location', 'Lokasi')} <span className="text-[#ff9a5c]">*</span>
                  </p>
                  <button
                    type="button"
                    onClick={useGps}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-white/10"
                  >
                    {geoState === 'busy' ? <Spinner size={12} /> : <IconPin size={14} />} {t('Use my location', 'Pakai lokasi saya')}
                  </button>
                </div>
                <div className="mt-2">
                  <LocationPicker value={pos} onChange={(lat, lon) => setPos({ lat, lon })} points={points} />
                </div>
                <p className="num mt-1.5 text-xs text-ink-3">
                  {pos
                    ? `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}`
                    : geoState === 'denied'
                      ? t('Location access was blocked. Tap the map instead.', 'Akses lokasi diblokir. Ketuk peta sebagai gantinya.')
                      : t('Tap the map where the fire is, or use your location.', 'Ketuk peta di lokasi api, atau pakai lokasi Anda.')}
                </p>
              </div>

              {/* 3. jenis */}
              <fieldset>
                <legend className="text-sm font-semibold text-ink">3. {t('What do you see?', 'Apa yang terlihat?')}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {cats.map((c) => (
                    <label
                      key={c.key}
                      className={`cursor-pointer rounded-[14px] border px-3 py-2.5 transition-colors ${category === c.key ? 'border-sun bg-sun/10' : 'border-line hover:bg-white/5'}`}
                    >
                      <input type="radio" name="cat" className="sr-only" checked={category === c.key} onChange={() => setCategory(c.key)} />
                      <span className="block text-sm font-semibold text-ink">{c.label}</span>
                      <span className="block text-xs text-ink-3">{c.hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* 4. keterangan */}
              <label className="block">
                <span className="text-sm font-semibold text-ink">
                  4. {t('Describe it', 'Keterangan')} <span className="text-[#ff9a5c]">*</span>
                </span>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder={t('e.g. Fire about 200 m east of the village road, spreading towards the palm plantation.', 'mis. Api sekitar 200 m di timur jalan desa, menjalar ke arah kebun sawit.')}
                  className={`${field} py-2.5`}
                />
                <span className="num text-xs text-ink-3">{desc.trim().length}/1000 · {t('at least 10 characters', 'minimal 10 karakter')}</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-ink">{t('Name (optional)', 'Nama (opsional)')}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={`${field} h-11`} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">{t('Phone (optional)', 'Telepon (opsional)')}</span>
                  <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} inputMode="tel" className={`${field} h-11`} />
                </label>
              </div>
              <p className="text-xs leading-5 text-ink-3">
                {t('Only your initial is shown publicly. Your phone number is never shown.', 'Hanya inisial Anda yang tampil ke publik. Nomor telepon tidak pernah ditampilkan.')}
              </p>

              {state === 'error' && (
                <p className="text-sm text-danger-ink">{errMsg || t('Could not send the report. Please try again.', 'Laporan gagal dikirim. Coba lagi.')}</p>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={!ready || state === 'busy'}>
                {state === 'busy' ? <Spinner /> : null} {t('Send report', 'Kirim laporan')}
              </Button>
              {!ready && (
                <p className="text-center text-xs text-ink-3">
                  {t('Photo, location and a short description are required.', 'Foto, lokasi, dan keterangan singkat wajib diisi.')}
                </p>
              )}
            </form>
          )}

          <aside className="space-y-3">
            <div className="glass rounded-[20px] p-5">
              <p className="font-semibold text-ink">{t('How reports are checked', 'Cara laporan diperiksa')}</p>
              <ol className="mt-3 space-y-3 text-sm leading-6 text-ink-2">
                {[
                  [t('Photo is required', 'Foto wajib'), t('The file must be a real image. No photo, no report.', 'File harus gambar asli. Tanpa foto, tidak ada laporan.')],
                  [t('Photo GPS and time', 'GPS dan waktu foto'), t('If the photo has GPS, it must be close to the location you marked.', 'Bila foto punya GPS, lokasinya harus dekat dengan titik yang Anda tandai.')],
                  [t('Satellite cross-check', 'Cocokkan dengan satelit'), t('We look for NASA FIRMS hotspots within 5 km in the last 48 hours.', 'Kami mencari titik panas NASA FIRMS dalam 5 km selama 48 jam terakhir.')],
                  [t('Officer review', 'Tinjauan petugas'), t('Reports without a match wait for an officer before they count.', 'Laporan tanpa kecocokan menunggu petugas sebelum dihitung.')],
                ].map(([k, v], i) => (
                  <li key={k} className="flex gap-3">
                    <span className="grad-sun num grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold">{i + 1}</span>
                    <span>
                      <b className="text-ink">{k}.</b> {v}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="glass rounded-[20px] p-5 text-sm leading-6 text-ink-2">
              <p className="font-semibold text-ink">{t('Stay safe', 'Tetap aman')}</p>
              <p className="mt-1">
                {t(
                  'Do not walk towards the fire to take a photo. Stay upwind, keep a road or river between you and the fire, and wear a mask in smoke.',
                  'Jangan mendekati api untuk memotret. Tetap di sisi melawan angin, pastikan ada jalan atau sungai di antara Anda dan api, dan pakai masker di area berasap.',
                )}
              </p>
            </div>
          </aside>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6" aria-labelledby="terbaru">
          <h2 id="terbaru" className="text-3xl font-bold tracking-tight text-ink">
            {t('Latest citizen reports', 'Laporan warga terbaru')}
          </h2>
          <div className="mt-5">{reports ? <ReportList reports={reports} compact /> : <div className="skeleton h-40 rounded-[20px]" />}</div>
        </section>
        <SiteFooter />
      </div>
    </div>
  );
}
