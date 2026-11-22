'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import PageGuide from '@/components/guide/PageGuide';
import { ArtCamera, ArtCheck, ArtOfficer, ArtPin } from '@/components/guide/art';
import { IconAlert, IconCamera, IconCheck, IconClose, IconPin } from '@/components/ui/icons';
import { Button, Spinner } from '@/components/ui/primitives';
import SiteFooter from '@/components/ui/SiteFooter';
import SiteHeader from '@/components/ui/SiteHeader';
import { HOTLINES } from '@/lib/bantuan';
import { readExif } from '@/lib/exif';
import { locale } from '@/lib/i18n';
import { stampTime, watermarkPhoto } from '@/lib/watermark';
import ReportList, { type AiLabel, type PublicReport, StatusPill, useAiLabel } from './ReportList';

const LocationPicker = dynamic(() => import('./LocationPicker'), { ssr: false, loading: () => <div className="skeleton h-[320px] rounded-[16px]" /> });
const CameraCapture = dynamic(() => import('./CameraCapture'), { ssr: false });

type Category = PublicReport['category'];

interface AiCheck {
  label: AiLabel;
  confidence: number;
  reason: string;
}

interface Result {
  id: string;
  status: 'matched' | 'pending';
  satelliteKm: number | null;
  exifKm: number | null;
  hasExifGps: boolean;
  takenAt: string | null;
  tooOld: boolean;
  source: 'camera' | 'gallery';
  place: string;
  ai: AiCheck | null;
}

/** Foto mentah sebelum watermark. */
interface RawPhoto {
  src: Blob | HTMLCanvasElement;
  source: 'camera' | 'gallery';
  exif: { lat: number | null; lon: number | null; takenAt: string | null };
  capturedAt: Date | null;
}

const MAX = 12 * 1024 * 1024;

export default function LaporView() {
  const t = useT();
  const params = useSearchParams();
  const pre = params.get('lokasi')?.split(',').map(Number);
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(pre && pre.length === 2 && pre.every(Number.isFinite) ? { lat: pre[0], lon: pre[1] } : null);
  const [place, setPlace] = useState<{ state: 'idle' | 'checking' | 'ok' | 'outside'; name: string | null }>({ state: 'idle', name: null });
  const [raw, setRaw] = useState<RawPhoto | null>(null);
  const [stamped, setStamped] = useState<{ blob: Blob; url: string } | null>(null);
  const [camera, setCamera] = useState(false);
  const [category, setCategory] = useState<Category>('fire');
  const [desc, setDesc] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [geoState, setGeoState] = useState<'idle' | 'busy' | 'denied'>('idle');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [rejected, setRejected] = useState<AiCheck | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [reports, setReports] = useState<PublicReport[] | null>(null);
  const [fileErr, setFileErr] = useState('');

  const loadReports = useCallback(() => {
    fetch('/api/lapor')
      .then((r) => r.json() as Promise<{ reports: PublicReport[] }>)
      .then((d) => setReports(d.reports))
      .catch(() => setReports([]));
  }, []);
  useEffect(loadReports, [loadReports]);

  // lokasi harus di daratan Indonesia: cek provinsi tiap kali titik berubah
  useEffect(() => {
    if (!pos) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlace({ state: 'checking', name: null });
    fetch(`/api/area/provinsi?lat=${pos.lat.toFixed(5)}&lon=${pos.lon.toFixed(5)}`)
      .then((r) => r.json() as Promise<{ province: string | null }>)
      .then((d) => alive && setPlace(d.province ? { state: 'ok', name: d.province } : { state: 'outside', name: null }))
      .catch(() => alive && setPlace({ state: 'ok', name: null }));
    return () => {
      alive = false;
    };
  }, [pos]);

  // watermark: tanggal, jam, koordinat, provinsi dicetak ke foto begitu foto dan lokasi siap
  useEffect(() => {
    if (!raw || !pos || place.state !== 'ok') return;
    let alive = true;
    const takenAt = raw.source === 'camera' ? raw.capturedAt : raw.exif.takenAt ? new Date(`${raw.exif.takenAt}+07:00`) : null;
    watermarkPhoto(raw.src, { lat: pos.lat, lon: pos.lon, province: place.name, reportedAt: new Date(), takenAt, source: raw.source })
      .then((blob) => {
        if (!alive) return;
        setStamped((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
      })
      .catch(() => alive && setFileErr(t('Could not read this photo. Try another one.', 'Foto ini tidak bisa dibaca. Coba foto lain.')));
    return () => {
      alive = false;
    };
  }, [raw, pos, place, t]);

  const locateMe = useCallback(() => {
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
  }, []);

  const pickFile = async (f: File | null) => {
    setFileErr('');
    setRejected(null);
    if (!f) return;
    if (f.size > MAX) return setFileErr(t('The photo must be 12 MB or smaller.', 'Foto maksimal 12 MB.'));
    const head = new Uint8Array(await f.slice(0, 256 * 1024).arrayBuffer());
    const exif = readExif(head);
    setStamped(null);
    setRaw({ src: f, source: 'gallery', exif, capturedAt: null });
    // GPS foto dipakai sebagai lokasi awal bila belum ada
    if (!pos && exif.lat !== null && exif.lon !== null) setPos({ lat: exif.lat, lon: exif.lon });
  };

  const onCapture = (frame: HTMLCanvasElement) => {
    setCamera(false);
    setRejected(null);
    setFileErr('');
    setStamped(null);
    setRaw({ src: frame, source: 'camera', exif: { lat: null, lon: null, takenAt: null }, capturedAt: new Date() });
    locateMe();
  };

  const hasPhoto = !!raw;
  const hasPlace = !!pos && place.state === 'ok';
  const hasDesc = desc.trim().length >= 10;
  const ready = !!stamped && hasPlace && hasDesc;
  const progress = [hasPhoto, hasPlace, true, hasDesc];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || !stamped || !pos || !raw) return;
    setState('busy');
    setErrMsg('');
    setRejected(null);
    const fd = new FormData();
    fd.set('photo', new File([stamped.blob], 'laporan.jpg', { type: 'image/jpeg' }));
    fd.set('lat', String(pos.lat));
    fd.set('lon', String(pos.lon));
    fd.set('category', category);
    fd.set('description', desc.trim());
    fd.set('source', raw.source);
    if (raw.capturedAt) fd.set('capturedAt', raw.capturedAt.toISOString());
    if (raw.exif.lat !== null && raw.exif.lon !== null) {
      fd.set('exifLat', String(raw.exif.lat));
      fd.set('exifLon', String(raw.exif.lon));
    }
    if (raw.exif.takenAt) fd.set('exifTakenAt', raw.exif.takenAt);
    if (name) fd.set('name', name);
    if (contact) fd.set('contact', contact);
    try {
      const res = await fetch('/api/lapor', { method: 'POST', body: fd });
      const json = (await res.json()) as Result & { error?: { code: string; message: string }; ai?: AiCheck };
      if (res.status === 409 && json.error?.code === 'duplicate_report') {
        setFileErr(t(
          'This photo was reported near the same location in the last 24 hours. Wait for the officer or send another distinct photo.',
          'Foto ini sudah dilaporkan di lokasi sekitar dalam 24 jam terakhir. Tunggu petugas atau kirim foto lain yang berbeda.',
        ));
        setState('idle');
        return;
      }
      if (res.status === 422 && json.error?.code === 'not_fire') {
        setRejected(json.ai ?? { label: 'none', confidence: 1, reason: '' });
        setState('idle');
        return;
      }
      if (!res.ok) throw new Error(json.error?.code === 'outside_indonesia' ? t('The location must be on land in Indonesia.', 'Lokasi harus di daratan Indonesia.') : 'error');
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
    setRaw(null);
    setStamped(null);
    setDesc('');
  };

  const points = useMemo(() => (reports ?? []).map((r) => ({ lat: r.lat, lon: r.lon, kind: 'report' as const })), [reports]);
  const cats: { key: Category; label: string; hint: string }[] = [
    { key: 'fire', label: t('Open fire', 'Api terlihat'), hint: t('Flames are visible', 'Nyala api terlihat') },
    { key: 'smoke', label: t('Smoke only', 'Asap saja'), hint: t('Smoke rising, no flames seen', 'Asap naik, api tidak terlihat') },
    { key: 'burnt', label: t('Burnt area', 'Bekas terbakar'), hint: t('Black ground, may still smoulder', 'Tanah hitam, bisa masih membara') },
  ];
  const field = 'mt-1.5 w-full rounded-[12px] border border-line-strong bg-black/25 px-3 text-ink placeholder:text-ink-3 focus:border-sun focus:outline-none';
  const stepTitles = [t('Photo', 'Foto'), t('Location', 'Lokasi'), t('Type', 'Jenis'), t('Details', 'Keterangan')];

  const guide = [
    {
      art: <ArtCamera />,
      title: t('1. Take a photo on the spot', '1. Foto langsung di lokasi'),
      body: t(
        'Tap "Open camera". A live photo is trusted more than one from the gallery. Stay at a safe distance, upwind.',
        'Ketuk "Buka kamera". Foto langsung lebih dipercaya daripada foto galeri. Tetap di jarak aman, melawan arah angin.',
      ),
    },
    {
      art: <ArtPin />,
      title: t('2. Confirm the location', '2. Pastikan lokasinya'),
      body: t(
        'Your GPS fills it in. You can tap the map to move the pin to where the fire is. Only places in Indonesia are accepted.',
        'GPS Anda mengisinya otomatis. Ketuk peta untuk memindahkan pin ke titik api. Hanya lokasi di Indonesia yang diterima.',
      ),
    },
    {
      art: <ArtCheck />,
      title: t('3. The photo gets a stamp and an AI check', '3. Foto diberi cap dan dicek AI'),
      body: t(
        'Date, time, coordinates and province are printed onto the photo. AI checks that it really shows fire, smoke or burnt land; we compare it with satellite hotspots.',
        'Tanggal, jam, koordinat, dan provinsi dicetak di foto. AI memeriksa apakah foto benar-benar berisi api, asap, atau lahan terbakar; lalu dicocokkan dengan titik panas satelit.',
      ),
    },
    {
      art: <ArtOfficer />,
      title: t('4. An officer confirms it', '4. Petugas mengonfirmasi'),
      body: t(
        'A BPBD officer reviews each report and marks it "Verified" or rejects it. You can follow the status in the list below.',
        'Petugas BPBD meninjau tiap laporan lalu menandainya "Diverifikasi" atau menolaknya. Statusnya bisa dilihat di daftar bawah.',
      ),
    },
  ];

  return (
    <div className="min-h-dvh bg-paper">
      <div className="grad-canopy">
        <SiteHeader cta={false} />
        <section className="mx-auto max-w-[1200px] px-4 pb-10 pt-8 sm:px-6">
          <p className="text-sm font-semibold text-[#ff9a5c]">{t('Report a fire', 'Lapor api')}</p>
          <h1 className="mt-2 max-w-[760px] text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {t('Seen fire or smoke? Send a photo.', 'Melihat api atau asap? Kirim fotonya.')}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {HOTLINES.slice(0, 2).map((h) => (
              <a key={h.number} href={`tel:${h.number}`} className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-ink hover:bg-white/10">
                <b className="num text-sun">{h.number}</b> {h.number === '112' ? t('Emergency', 'Darurat') : t('Fire brigade', 'Pemadam kebakaran')}
              </a>
            ))}
            <span className="text-xs text-ink-3">{t('Life in danger? Call first, report after.', 'Nyawa terancam? Telepon dulu, lapor kemudian.')}</span>
          </div>
        </section>
      </div>

      <div className="grad-canopy-soft">
        <section className="mx-auto grid max-w-[1200px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
          {result ? (
            <ResultCard result={result} photoUrl={stamped?.url ?? null} onReset={reset} />
          ) : (
            <form onSubmit={submit} className="glass space-y-6 rounded-[24px] p-5 sm:p-6" noValidate>
              {/* progres langkah */}
              <ol className="grid grid-cols-4 gap-2" aria-label={t('Progress', 'Progres')}>
                {stepTitles.map((s, i) => (
                  <li key={s} className="text-center">
                    <span
                      className={`num mx-auto grid size-8 place-items-center rounded-full text-xs font-bold ${progress[i] ? 'grad-sun' : 'bg-white/10 text-ink-3'}`}
                    >
                      {progress[i] ? <IconCheck size={14} /> : i + 1}
                    </span>
                    <span className={`mt-1 block text-[11px] font-semibold ${progress[i] ? 'text-ink' : 'text-ink-3'}`}>{s}</span>
                  </li>
                ))}
              </ol>

              {/* 1. foto */}
              <div>
                <p className="text-sm font-semibold text-ink">
                  1. {t('Photo', 'Foto')} <span className="text-[#ff9a5c]">*</span>
                </p>
                {stamped || raw ? (
                  <div className="mt-2 overflow-hidden rounded-[16px] border border-line bg-black/30">
                    {stamped ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={stamped.url} alt={t('Photo with date and location stamp', 'Foto dengan cap tanggal dan lokasi')} className="max-h-[380px] w-full object-contain" />
                    ) : (
                      <p className="grid h-40 place-items-center px-4 text-center text-sm text-ink-2">
                        {hasPlace ? <Spinner /> : t('Set the location (step 2) to stamp the photo.', 'Isi lokasi (langkah 2) agar foto diberi cap.')}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-ink-2">
                      <span>
                        {raw?.source === 'camera' ? t('Live camera photo', 'Foto kamera langsung') : t('Photo from gallery', 'Foto dari galeri')}
                        {raw?.source === 'gallery' && !raw.exif.takenAt ? ` · ${t('no capture time', 'tanpa waktu ambil')}` : ''}
                      </span>
                      <button type="button" onClick={() => (setRaw(null), setStamped(null))} className="font-semibold text-ink underline-offset-4 hover:underline">
                        {t('Change photo', 'Ganti foto')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setCamera(true)}
                      className="grad-fire flex min-h-32 flex-col items-center justify-center gap-2 rounded-[16px] p-4 text-center text-white transition-[filter] hover:brightness-110"
                    >
                      <IconCamera size={30} />
                      <span className="text-[15px] font-bold">{t('Open camera', 'Buka kamera')}</span>
                      <span className="text-xs text-white/85">{t('Recommended: most trusted', 'Disarankan: paling dipercaya')}</span>
                    </button>
                    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-line-strong bg-black/20 p-4 text-center hover:bg-white/5">
                      <span className="text-[15px] font-semibold text-ink">{t('Choose from gallery', 'Pilih dari galeri')}</span>
                      <span className="text-xs text-ink-3">JPEG, PNG, WebP · {t('max', 'maks')} 12 MB</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pickFile(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                )}
                <p className="mt-2 rounded-[12px] bg-black/20 px-3 py-2 text-xs leading-5 text-ink-3">
                  {t(
                    'Automatic check: if the photo clearly shows no fire, smoke or burnt land, it is returned for a clearer photo. If AI is unavailable, the officer still reviews it; no report is silently marked verified.',
                    'Pemeriksaan otomatis: jika foto jelas tidak berisi api, asap, atau lahan terbakar, laporan dikembalikan agar Anda kirim foto yang lebih jelas. Jika AI tidak tersedia, petugas tetap meninjau; tidak ada laporan yang otomatis dianggap terverifikasi.',
                  )}
                </p>
                {fileErr && <p className="mt-1 text-sm text-danger-ink">{fileErr}</p>}
                {rejected && (
                  <div className="mt-2 flex gap-3 rounded-[14px] border border-danger/40 bg-danger/10 p-3 text-sm text-ink">
                    <IconAlert size={18} className="mt-0.5 shrink-0 text-danger-ink" />
                    <div>
                      <p className="font-semibold">{t('This photo was not accepted.', 'Foto ini tidak diterima.')}</p>
                      <p className="mt-0.5 text-ink-2">
                        {t('The AI check found no fire, smoke or burnt land in it.', 'Pemeriksaan AI tidak menemukan api, asap, atau lahan terbakar di foto ini.')}
                        {rejected.reason ? ` "${rejected.reason}"` : ''}
                      </p>
                      <p className="mt-1 text-xs text-ink-3">{t('Take a clearer photo that shows the fire or smoke.', 'Ambil foto yang lebih jelas memperlihatkan api atau asap.')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. lokasi */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    2. {t('Location', 'Lokasi')} <span className="text-[#ff9a5c]">*</span>
                  </p>
                  <button
                    type="button"
                    onClick={locateMe}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink hover:bg-white/10"
                  >
                    {geoState === 'busy' ? <Spinner size={12} /> : <IconPin size={14} />} {t('Use my location', 'Pakai lokasi saya')}
                  </button>
                </div>
                <div className="mt-2">
                  <LocationPicker value={pos} onChange={(lat, lon) => setPos({ lat, lon })} points={points} />
                </div>
                <p className={`num mt-1.5 text-xs ${place.state === 'outside' ? 'font-semibold text-danger-ink' : 'text-ink-3'}`}>
                  {!pos
                    ? geoState === 'denied'
                      ? t('Location access was blocked. Tap the map instead.', 'Akses lokasi diblokir. Ketuk peta sebagai gantinya.')
                      : t('Tap the map where the fire is, or use your location.', 'Ketuk peta di lokasi api, atau pakai lokasi Anda.')
                    : place.state === 'outside'
                      ? t('This point is outside Indonesian land (sea or another country). Tap a spot in Indonesia.', 'Titik ini di luar daratan Indonesia (laut atau negara lain). Ketuk lokasi di Indonesia.')
                      : `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}${place.name ? ` · ${place.name}` : ''}${place.state === 'checking' ? ' ...' : ''}`}
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
                <span className="num text-xs text-ink-3">
                  {desc.trim().length}/1000 · {t('at least 10 characters', 'minimal 10 karakter')}
                </span>
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
                {t('Only your initial is shown publicly. The officer may call you to confirm.', 'Hanya inisial Anda yang tampil ke publik. Petugas mungkin menelepon untuk konfirmasi.')}
              </p>

              {state === 'error' && <p className="text-sm text-danger-ink">{errMsg || t('Could not send the report. Please try again.', 'Laporan gagal dikirim. Coba lagi.')}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={!ready || state === 'busy'}>
                {state === 'busy' ? (
                  <>
                    <Spinner /> {t('Checking the photo...', 'Memeriksa foto...')}
                  </>
                ) : (
                  t('Send report', 'Kirim laporan')
                )}
              </Button>
              {!ready && (
                <p className="text-center text-xs text-ink-3">
                  {t('Still needed', 'Masih perlu')}: {[!hasPhoto && t('photo', 'foto'), !hasPlace && t('location in Indonesia', 'lokasi di Indonesia'), !hasDesc && t('description', 'keterangan')].filter(Boolean).join(', ')}
                </p>
              )}
            </form>
          )}

          <aside className="space-y-3">
            <div className="glass rounded-[20px] p-5">
              <p className="font-semibold text-ink">{t('How a report is confirmed', 'Cara laporan dikonfirmasi')}</p>
              <ol className="mt-4 space-y-4">
                {guide.map((g) => (
                  <li key={g.title} className="grid grid-cols-[120px_1fr] items-start gap-3">
                    <span className="block overflow-hidden rounded-[12px] bg-black/25">{g.art}</span>
                    <span className="text-sm leading-6 text-ink-2">
                      <b className="block text-ink">{g.title}</b>
                      {g.body}
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

      {camera && <CameraCapture onCapture={onCapture} onClose={() => setCamera(false)} />}
      <PageGuide id="lapor" title={t('How to report a fire', 'Cara melapor api')} steps={guide} />
    </div>
  );
}

function ResultCard({ result, photoUrl, onReset }: { result: Result; photoUrl: string | null; onReset: () => void }) {
  const t = useT();
  const ai = useAiLabel();
  const aiOk = result.ai ? ['fire', 'smoke', 'burnt'].includes(result.ai.label) : null;
  const checks: { ok: boolean | null; text: string }[] = [
    {
      ok: aiOk,
      text: result.ai
        ? `${ai(result.ai.label)} (${Math.round(result.ai.confidence * 100)}%)${result.ai.reason ? `: ${result.ai.reason}` : ''}`
        : t('AI check unavailable right now; an officer will look at the photo.', 'Pemeriksaan AI sedang tidak tersedia; petugas akan melihat fotonya.'),
    },
    { ok: true, text: t(`Location is in ${result.place}, Indonesia.`, `Lokasi berada di ${result.place}, Indonesia.`) },
    {
      ok: result.takenAt ? !result.tooOld : null,
      text: result.takenAt
        ? result.tooOld
          ? t(`Photo is older than 48 hours (${stampTime(new Date(result.takenAt), result.place)}).`, `Foto lebih tua dari 48 jam (${stampTime(new Date(result.takenAt), result.place)}).`)
          : t(`Photo taken ${stampTime(new Date(result.takenAt), result.place)}.`, `Foto diambil ${stampTime(new Date(result.takenAt), result.place)}.`)
        : t('The photo has no capture time (common for gallery photos sent through chat).', 'Foto tidak punya waktu ambil (biasa untuk foto galeri yang dikirim lewat chat).'),
    },
    {
      ok: result.satelliteKm !== null ? result.satelliteKm <= 5 : null,
      text:
        result.satelliteKm !== null
          ? t(`Nearest NASA satellite hotspot (48 h): ${result.satelliteKm.toLocaleString(locale())} km away.`, `Titik panas satelit NASA terdekat (48 jam): ${result.satelliteKm.toLocaleString(locale())} km.`)
          : t('No satellite hotspot nearby in the last 48 h (small fires are often missed).', 'Tidak ada titik panas satelit di dekatnya dalam 48 jam (api kecil sering terlewat satelit).'),
    },
  ];
  if (result.hasExifGps && result.exifKm !== null)
    checks.push({
      ok: result.exifKm <= 5,
      text: t(`Photo GPS is ${result.exifKm.toLocaleString(locale())} km from the marked spot.`, `GPS foto berjarak ${result.exifKm.toLocaleString(locale())} km dari titik yang ditandai.`),
    });

  const next = [
    [t('Received', 'Diterima'), true],
    [t('Checked automatically', 'Dicek otomatis'), true],
    [t('Reviewed by officer', 'Ditinjau petugas'), false],
    [t('Passed to BPBD / Manggala Agni', 'Diteruskan ke BPBD / Manggala Agni'), false],
  ] as const;

  return (
    <div className="glass rounded-[24px] p-6">
      <div className="flex items-center gap-3">
        <span className="grad-sun grid size-12 shrink-0 place-items-center rounded-full">
          <IconCheck size={22} />
        </span>
        <div>
          <h2 className="text-2xl font-bold text-ink">{t('Report received', 'Laporan diterima')}</h2>
          <div className="mt-1">
            <StatusPill status={result.status} />
          </div>
        </div>
      </div>
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={t('Your stamped photo', 'Foto Anda yang sudah diberi cap')} className="mt-5 max-h-72 w-full rounded-[14px] object-contain bg-black/30" />
      )}
      <p className="mt-5 text-sm font-semibold text-ink">{t('Automatic checks', 'Pemeriksaan otomatis')}</p>
      <ul className="mt-2 space-y-2 text-sm text-ink-2">
        {checks.map((c) => (
          <li key={c.text} className="flex gap-2">
            {c.ok === false ? (
              <IconClose size={16} className="mt-0.5 shrink-0 text-danger-ink" />
            ) : (
              <IconCheck size={16} className={`mt-0.5 shrink-0 ${c.ok ? 'text-ok' : 'text-ink-3'}`} />
            )}
            {c.text}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm font-semibold text-ink">{t('What happens next', 'Selanjutnya')}</p>
      <ol className="mt-3 grid grid-cols-4 gap-1">
        {next.map(([label, done], i) => (
          <li key={label} className="text-center">
            <span className={`mx-auto block h-1.5 rounded-full ${done ? 'bg-[linear-gradient(90deg,#9be15d,#ffd24a)]' : 'bg-white/10'}`} />
            <span className={`mt-1.5 block text-[11px] leading-4 ${done ? 'font-semibold text-ink' : 'text-ink-3'}`}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-5 text-ink-3">
        {t(
          '"Matched" = the AI sees fire or smoke and a satellite hotspot or the photo GPS is within 5 km. Every report is still reviewed by an officer before it is marked "Verified".',
          '"Cocok" = AI melihat api atau asap dan ada titik panas satelit atau GPS foto dalam 5 km. Setiap laporan tetap ditinjau petugas sebelum ditandai "Diverifikasi".',
        )}
      </p>
      <Button className="mt-6" onClick={onReset}>
        {t('Send another report', 'Kirim laporan lain')}
      </Button>
    </div>
  );
}
