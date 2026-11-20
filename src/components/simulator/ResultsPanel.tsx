'use client';

import { useState } from 'react';
import { IconCheck, IconInfo, IconPin, IconSplit, IconUndo } from '@/components/ui/icons';
import { Button, LiveNumber, Segmented, StatusBadge, Switch } from '@/components/ui/primitives';
import { nf, stepToClock } from '@/lib/format';
import { BREAK_COLORS, BREAK_LABELS, breakSentence, describeBreak, fmtCoord, ignitionPoint } from '@/lib/geo';
import { FIREBREAK_BUILD_HOURS, RISK_THRESHOLDS, STEP_MINUTES } from '@/lib/sim/params';
import ResponseTab from '@/components/response/ResponseTab';
import type { PlanSet, ResponsePlan } from '@/lib/response/types';
import { useSim } from '@/stores/simStore';

const LEVEL_RULES = [
  ['var(--color-danger)', 'Awas', `api < ${RISK_THRESHOLDS.awas} jam`],
  ['var(--color-alert)', 'Siaga', `${RISK_THRESHOLDS.awas}–${RISK_THRESHOLDS.siaga} jam`],
  ['var(--color-warn)', 'Waspada', `> ${RISK_THRESHOLDS.siaga} jam`],
  ['var(--color-ok)', 'Aman', 'tidak terjangkau'],
] as const;

/* ---------------- Tab: Dampak ---------------- */
function ImpactTab({ onFocusVillage }: { onFocusVillage: (name: string) => void }) {
  const s = useSim();
  const base = s.baseline!;
  const main = s.withBreak ?? base;
  const t = s.timeStep;
  const nowHours = (t * STEP_MINUTES) / 60;
  const villages = [...main.villageRisks].sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99));
  const first = villages.find((v) => v.etaHours !== null);
  const baseVill = new Map(base.villageRisks.map((v) => [v.villageName, v]));
  const pop = new Map((s.scenario?.villages ?? []).map((v) => [v.name, v.population]));
  const km2Now = main.burnedByStep[Math.min(t, main.burnedByStep.length - 1)] ?? 0;
  const label = s.appliedRank ? BREAK_LABELS[s.appliedRank - 1] : null;

  return (
    <div className="space-y-5">
      <header>
        <p className="font-display text-[34px] font-bold leading-none tracking-tight">
          <LiveNumber value={`${nf(main.burnedKm2)} km²`} />
        </p>
        <h2 className="mt-2 text-[15px] font-semibold leading-6">
          perkiraan area terbakar dalam 12 jam, {s.withBreak ? `dengan Sekat ${label}` : 'tanpa sekat'}
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {first
            ? `${first.villageName} terjangkau paling dulu, sekitar ${nf(first.etaHours ?? 0)} jam dari sekarang.`
            : 'Tidak ada desa yang terjangkau api dalam 12 jam.'}
          {s.withBreak && (
            <>
              {' '}
              Tanpa sekat: <span className="num">{nf(base.burnedKm2)} km²</span>.
            </>
          )}
        </p>
      </header>

      <div className="flex items-center justify-between rounded-[8px] bg-bg-base px-3 py-2.5 text-sm">
        <span className="text-text-secondary">Sudah terbakar pada {stepToClock(t)}</span>
        <span className="num font-semibold">{nf(km2Now)} km²</span>
      </div>

      {main.edge && (
        <p className="rounded-[8px] bg-bg-base px-3 py-2.5 text-sm leading-6 text-text-secondary">
          <b className="text-text-primary">Api mencapai batas area simulasi</b> (garis putus-putus di peta). Di luar kotak 16 x 16 km
          api tidak dihitung, jadi sebaran nyata bisa lebih luas dari yang terlihat.
        </p>
      )}

      <section aria-labelledby="desa-h">
        <h3 id="desa-h" className="mb-2 text-sm font-semibold text-text-secondary">
          Desa, urut dari yang paling dulu terjangkau
        </h3>
        <ul className="divide-y divide-line-dark overflow-hidden rounded-[8px] bg-bg-base">
          {villages.map((v) => {
            const arrived = v.etaHours !== null && v.etaHours <= nowHours;
            const b = baseVill.get(v.villageName);
            const changed = s.withBreak && b && b.etaHours !== v.etaHours;
            return (
              <li key={v.villageName}>
                <button
                  onClick={() => onFocusVillage(v.villageName)}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-bg-elevated"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{v.villageName}</span>
                    <span className="num block text-sm text-text-secondary">
                      {v.etaHours === null
                        ? 'Api tidak sampai dalam 12 jam'
                        : `Api tiba ±${nf(v.etaHours)} jam (pukul ${stepToClock((v.etaHours * 60) / STEP_MINUTES)})`}
                    </span>
                    <span className="num block text-xs text-text-muted">
                      {v.etaHours !== null &&
                        (arrived ? `Pada ${stepToClock(t)}: api sudah tiba · ` : `Pada ${stepToClock(t)}: ${nf(v.etaHours - nowHours)} jam lagi · `)}
                      ±{(pop.get(v.villageName) ?? 0).toLocaleString('id-ID')} jiwa · peluang {Math.round(v.burnProbability * 100)}%
                    </span>
                    {changed && (
                      <span className="num block text-xs text-firebreak">
                        Tanpa sekat: {b.etaHours === null ? 'tidak terjangkau' : `tiba ${nf(b.etaHours)} jam`}
                      </span>
                    )}
                  </span>
                  <StatusBadge level={v.level} />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-text-muted">
          {LEVEL_RULES.map(([c, l, r]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: c }} />
              <b className="font-semibold text-text-secondary">{l}</b> {r}
            </span>
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-text-muted">
        Level ditentukan dari perkiraan jam tiba api (rata-rata 12 kali simulasi). Klik desa untuk melihatnya di peta.
      </p>
    </div>
  );
}

/* ---------------- Tab: Sekat bakar ---------------- */
function HowBreaksWork() {
  return (
    <ol className="space-y-2 text-sm leading-6 text-text-secondary">
      {[
        ['Sekat bakar', 'adalah jalur selebar ±500 m yang dibersihkan dari bahan bakar (dan dibasahi di gambut) sehingga api berhenti.'],
        ['Sistem menguji 225 garis', 'di depan arah sebaran api: 5 jarak, 3 sudut, 3 panjang, 5 posisi geser.'],
        ['Tiap garis disimulasikan ulang', `lalu dipilih tiga yang paling mengurangi kerusakan dan masih sempat dibangun (pembangunan dianggap ${FIREBREAK_BUILD_HOURS} jam).`],
        ['Hanya satu sekat diterapkan', 'pada satu waktu. Memilih sekat lain menggantikan sekat sebelumnya.'],
      ].map(([k, v], i) => (
        <li key={k} className="grid grid-cols-[22px_1fr] gap-1">
          <span className="num font-semibold text-text-primary">{i + 1}.</span>
          <span>
            <b className="text-text-primary">{k}</b> {v}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ScoreInfo() {
  return (
    <div className="rounded-[8px] bg-bg-base p-3 text-sm leading-6 text-text-secondary">
      <p className="font-semibold text-text-primary">Cara skor 0–100 dihitung</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>
          <b className="text-text-primary">Efektivitas</b>: seberapa besar risiko turun. Risiko diberi bobot: permukiman x100, kebun x10,
          gambut x5, hutan x3, semak x1. Penurunan 35% atau lebih dianggap penuh.
        </li>
        <li>
          <b className="text-text-primary">Faktor waktu</b>: sisa waktu setelah {FIREBREAK_BUILD_HOURS} jam pembangunan. Sisa 3 jam atau
          lebih bernilai penuh; mepet dikurangi hingga 40%.
        </li>
        <li>
          <b className="text-text-primary">Biaya panjang</b>: dikurangi 1,5 poin per km sekat.
        </li>
      </ol>
      <p className="mt-1">Skor = 100 x efektivitas x faktor waktu − 1,5 x panjang (km).</p>
    </div>
  );
}

function BreakTab({
  onRecommend,
  onApply,
  onShowBreak,
}: {
  onRecommend: () => void;
  onApply: (rank: number | null) => void;
  onShowBreak: (rank: number) => void;
}) {
  const s = useSim();
  const [scoreInfo, setScoreInfo] = useState(false);
  const [how, setHow] = useState(false);
  const ready = s.baseline?.quality === 'refined';
  const best = s.recommendations[0];
  const ign = s.scenario ? ignitionPoint(s.scenario.grid, s.ignitions ?? s.scenario.ignitions) : null;
  const allPeat = s.recommendations.length > 1 && s.recommendations.every((r) => r.peatBypassRisk);

  if (s.recState === 'idle') {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Di mana sekat bakar paling efektif?</h2>
        <HowBreaksWork />
        <Button tone="dark" size="md" className="w-full" onClick={onRecommend} disabled={!ready} loading={!ready}>
          Cari sekat terbaik
        </Button>
      </div>
    );
  }

  if (s.recState === 'running') {
    const pct = Math.round(s.recProgress * 100);
    return (
      <div className="space-y-3" aria-live="polite">
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Menguji garis sekat...</h2>
        <div className="h-2 overflow-hidden rounded-full bg-bg-base" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-firebreak transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <p className="num text-sm text-text-secondary">{pct}% dari 225 kandidat</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        {best ? (
          <>
            <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">
              Sekat A memangkas <span className="num">{nf(best.reductionPct)}%</span> area terbakar
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Tiga lokasi terbaik dari {s.recCandidates} garis yang diuji. Pilih satu untuk diterapkan; peta langsung menuju sekat itu.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Tidak ada sekat yang sempat dibangun</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{s.recEmptyReason}</p>
          </>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <button onClick={() => setHow(!how)} aria-expanded={how} className="font-semibold text-wind underline-offset-4 hover:underline">
            {how ? 'Tutup penjelasan' : 'Bagaimana sekat dipilih?'}
          </button>
          <button
            onClick={() => setScoreInfo(!scoreInfo)}
            aria-expanded={scoreInfo}
            className="inline-flex items-center gap-1 font-semibold text-wind underline-offset-4 hover:underline"
          >
            <IconInfo size={15} /> Arti skor
          </button>
        </div>
      </header>
      {how && <HowBreaksWork />}
      {scoreInfo && <ScoreInfo />}

      {s.recState === 'stale' && (
        <div className="flex items-center justify-between gap-3 rounded-[8px] bg-bg-base p-3 text-sm">
          <span className="text-text-secondary">Kondisi berubah sejak sekat dihitung.</span>
          <Button tone="dark" variant="secondary" size="sm" onClick={onRecommend}>
            Hitung ulang
          </Button>
        </div>
      )}

      {allPeat && (
        <p className="rounded-[8px] bg-bg-base px-3 py-2.5 text-sm leading-6 text-text-secondary">
          Ketiga sekat melintasi <b className="text-text-primary">gambut kering</b>: sertakan pembasahan atau sekat kanal agar api bawah
          tanah tidak lolos.
        </p>
      )}

      <ul className="space-y-2">
        {s.recommendations.map((r) => {
          const applied = s.appliedRank === r.rank;
          const active = s.activeRank === r.rank;
          const L = BREAK_LABELS[r.rank - 1];
          const color = BREAK_COLORS[r.rank - 1];
          const d = ign && s.scenario ? describeBreak(r.line.coordinates, ign, s.scenario.villages) : null;
          return (
            <li key={r.rank} id={`sekat-card-${r.rank}`} className="scroll-mt-16">
              <article
                onMouseEnter={() => s.appliedRank === null && s.set({ activeRank: r.rank })}
                aria-label={`Sekat ${L}`}
                className={`overflow-hidden rounded-[8px] border-l-4 p-3 transition-colors ${applied ? 'bg-bg-hover' : active ? 'bg-bg-elevated' : 'bg-bg-base'}`}
                style={{ borderLeftColor: color }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-semibold">
                    <span style={{ color }}>Sekat {L}</span>
                    {applied && (
                      <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-firebreak">
                        <IconCheck size={14} /> Diterapkan
                      </span>
                    )}
                  </h3>
                  <span className="num text-sm text-text-secondary">skor {nf(r.score, 0)}/100</span>
                </div>
                {d && <p className="mt-1 text-sm leading-6 text-text-secondary">{breakSentence(d)}</p>}
                {d && (
                  <dl className="num mt-2 space-y-0.5 rounded-[6px] bg-bg-base px-2.5 py-2 text-xs leading-5">
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 text-text-muted">Dari {L}1</dt>
                      <dd>{fmtCoord(d.from[0], d.from[1])}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 text-text-muted">Ke {L}2</dt>
                      <dd>{fmtCoord(d.to[0], d.to[1])}</dd>
                    </div>
                  </dl>
                )}
                <dl className="num mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-text-muted">Area terbakar</dt>
                    <dd className="font-semibold">−{nf(r.reductionPct)}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Selesai dalam</dt>
                    <dd className="font-semibold">{nf(r.marginHours + FIREBREAK_BUILD_HOURS)} jam</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Panjang x lebar</dt>
                    <dd className="font-semibold">
                      {nf(r.lengthKm)} km x {r.widthM} m
                    </dd>
                  </div>
                </dl>
                {r.peatBypassRisk && !allPeat && (
                  <p className="mt-2 text-sm leading-5 text-text-secondary">Melintasi gambut kering: sertakan pembasahan atau sekat kanal.</p>
                )}
                <div className="mt-3 flex gap-2">
                  {applied ? (
                    <Button tone="dark" variant="secondary" size="sm" className="flex-1" onClick={() => onApply(null)}>
                      <IconUndo size={16} /> Batalkan
                    </Button>
                  ) : (
                    <Button
                      tone="dark"
                      variant={r.rank === 1 && s.appliedRank === null ? 'primary' : 'secondary'}
                      size="sm"
                      className="flex-1"
                      onClick={() => onApply(r.rank)}
                    >
                      {s.appliedRank !== null ? `Ganti ke Sekat ${L}` : `Terapkan Sekat ${L}`}
                    </Button>
                  )}
                  <Button tone="dark" variant="ghost" size="sm" onClick={() => onShowBreak(r.rank)} aria-label={`Lihat Sekat ${L} di peta`}>
                    <IconPin size={16} /> Lihat di peta
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {s.appliedRank !== null && (
        <div className="rounded-[8px] bg-bg-base px-3">
          <Switch
            checked={s.compare}
            onChange={(v) => s.set({ compare: v })}
            label={
              <span className="inline-flex items-center gap-2 font-semibold">
                <IconSplit size={16} /> Bandingkan berdampingan
              </span>
            }
            hint="Peta kiri tanpa sekat, kanan dengan sekat"
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- Tab: Briefing & laporan ---------------- */
function parseBriefing(text: string) {
  const blocks: { title: string; lines: string[] }[] = [];
  let cur: { title: string; lines: string[] } | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
    if (!line) continue;
    const head = line.replace(/:$/, '').toUpperCase();
    if (['SITUASI', 'PRIORITAS TINDAKAN', 'CATATAN'].includes(head)) {
      cur = { title: head, lines: [] };
      blocks.push(cur);
    } else if (cur) cur.lines.push(line);
    else blocks.push((cur = { title: '', lines: [line] }));
  }
  return blocks;
}

function BriefTab({ onBriefing, onSave, saving }: { onBriefing: () => void; onSave: () => void; saving: boolean }) {
  const s = useSim();
  const ready = s.baseline?.quality === 'refined';
  const blocks = s.briefing ? parseBriefing(s.briefing.text) : [];
  const ign = s.scenario ? ignitionPoint(s.scenario.grid, s.ignitions ?? s.scenario.ignitions) : null;
  const label = s.appliedRank ? BREAK_LABELS[s.appliedRank - 1] : null;
  const situ = blocks.find((b) => b.title === 'SITUASI');
  const prio = blocks.find((b) => b.title === 'PRIORITAS TINDAKAN');
  const note = blocks.find((b) => b.title === 'CATATAN');
  const other = blocks.filter((b) => !b.title);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Briefing untuk posko</h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Gemini membaca hasil simulasi ini (titik api, desa, jam tiba{s.recommendations.length ? ', koordinat sekat' : ''}) dan menyusun
          tindakan spesifik untuk lokasi ini.
        </p>
      </header>

      {/* Angka kunci: selalu jelas tanpa/dengan sekat */}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-[8px] bg-bg-base p-3">
          <dt className="text-xs text-text-muted">Luas terbakar tanpa sekat</dt>
          <dd className="num mt-0.5 text-lg font-semibold">{nf(s.baseline?.burnedKm2 ?? 0)} km²</dd>
        </div>
        <div className="rounded-[8px] bg-bg-base p-3">
          <dt className="text-xs text-text-muted">{label ? `Dengan Sekat ${label}` : 'Dengan sekat'}</dt>
          <dd className="num mt-0.5 text-lg font-semibold">{s.withBreak ? `${nf(s.withBreak.burnedKm2)} km²` : 'Belum diterapkan'}</dd>
        </div>
        {ign && (
          <div className="col-span-2 rounded-[8px] bg-bg-base p-3">
            <dt className="text-xs text-text-muted">Titik awal api</dt>
            <dd className="num mt-0.5 font-semibold">{fmtCoord(ign[0], ign[1])}</dd>
          </div>
        )}
      </dl>

      {!s.briefing && (
        <Button tone="dark" className="w-full" onClick={onBriefing} disabled={!ready} loading={s.briefingState === 'loading'}>
          {s.briefingState === 'loading' ? 'Menyusun briefing...' : 'Susun briefing'}
        </Button>
      )}
      {s.briefingState === 'error' && <p className="text-sm text-danger">Briefing gagal disusun. Coba lagi.</p>}

      {s.briefing && (
        <div className="space-y-3" aria-live="polite">
          {[...other, ...(situ ? [situ] : [])].map((b, i) => (
            <section key={i} className="rounded-[12px] bg-bg-base p-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-wind">Situasi</h3>
              {b.lines.map((l, k) => (
                <p key={k} className="text-[15px] leading-7">
                  {l}
                </p>
              ))}
            </section>
          ))}
          {prio && (
            <section className="rounded-[12px] bg-bg-base p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-wind">Lakukan sekarang, berurutan</h3>
              <ol className="space-y-2.5">
                {prio.lines.map((l, k) => (
                  <li key={k} className="grid grid-cols-[26px_1fr] gap-2 text-[15px] leading-6">
                    <span className="num grid size-6 place-items-center rounded-full bg-text-primary text-xs font-bold text-bg-base">{k + 1}</span>
                    <span>{l.replace(/^[-*]\s*/, '')}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {note && <p className="px-1 text-sm leading-6 text-text-muted">{note.lines.join(' ')}</p>}
          <p className="px-1 text-xs text-text-muted">
            {s.briefing.source === 'gemini' ? `Disusun oleh ${s.briefing.model}` : 'Disusun dengan aturan tetap (Gemini tidak tersedia)'}. Briefing
            otomatis dihapus bila kondisi berubah.
          </p>
        </div>
      )}

      <div className="border-t border-line-dark pt-5">
        <h3 className="text-[15px] font-semibold">Bagikan ke BPBD</h3>
        <p className="mt-1 text-sm leading-6 text-text-secondary">Simpan hasil ini sebagai laporan yang bisa dicetak dan dibagikan lewat tautan.</p>
        {s.slug === 'live' ? (
          <p className="mt-2 rounded-[8px] bg-bg-base px-3 py-2.5 text-sm leading-6 text-text-secondary">
            Laporan cetak saat ini tersedia untuk wilayah contoh. Untuk lokasi titik panas langsung, bagikan AI Briefing di atas atau salin
            perintah pengerahan dari tab Respons.
          </p>
        ) : (
          <Button tone="dark" variant={s.briefing ? 'primary' : 'secondary'} className="mt-3 w-full" onClick={onSave} disabled={!ready} loading={saving}>
            {saving ? 'Menyimpan laporan...' : 'Simpan laporan'}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Panel hasil bertab ---------------- */
interface Props {
  onRecommend: () => void;
  onApply: (rank: number | null) => void;
  onShowBreak: (rank: number) => void;
  onFocusVillage: (name: string) => void;
  onBriefing: () => void;
  onSave: () => void;
  saving: boolean;
  hideTabs?: boolean;
  planSet: PlanSet | null;
  plan: ResponsePlan | null;
  onRefreshHotspots: () => void;
  refreshingHotspots: boolean;
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-4" aria-label="Memuat hasil" role="status">
      <div className="skeleton h-9 w-40 rounded-md" />
      <div className="skeleton h-4 w-56 rounded" />
      <div className="skeleton h-11 w-full rounded-[8px]" />
      <div className="skeleton h-48 w-full rounded-[8px]" />
      <span className="sr-only">Menghitung sebaran api 12 jam</span>
    </div>
  );
}

export default function ResultsPanel(props: Props) {
  const tab = useSim((s) => s.tab);
  const set = useSim((s) => s.set);
  const has = useSim((s) => s.baseline !== null);
  const recCount = useSim((s) => s.recommendations.length);
  return (
    <div>
      {!props.hideTabs && (
        <Segmented
          label="Bagian hasil"
          value={tab}
          onChange={(v) => set({ tab: v })}
          options={[
            { value: 'dampak', label: 'Dampak' },
            { value: 'sekat', label: recCount ? `Sekat (${recCount})` : 'Sekat' },
            { value: 'respons', label: 'Respons' },
            { value: 'briefing', label: 'Briefing' },
          ]}
          className="mb-5"
        />
      )}
      {!has ? (
        <ResultsSkeleton />
      ) : tab === 'dampak' ? (
        <ImpactTab onFocusVillage={props.onFocusVillage} />
      ) : tab === 'sekat' ? (
        <BreakTab onRecommend={props.onRecommend} onApply={props.onApply} onShowBreak={props.onShowBreak} />
      ) : tab === 'respons' ? (
        <ResponseTab set={props.planSet} plan={props.plan} onRefreshHotspots={props.onRefreshHotspots} refreshing={props.refreshingHotspots} />
      ) : (
        <BriefTab onBriefing={props.onBriefing} onSave={props.onSave} saving={props.saving} />
      )}
    </div>
  );
}
