'use client';

import { AlertTriangle, Columns2, FileText, Loader2, Sparkles, Undo2 } from 'lucide-react';
import { etaText, LEVEL_COLOR, LEVEL_LABEL, nf, stepToClock } from '@/lib/format';
import { STEP_MINUTES } from '@/lib/sim/params';
import type { RiskLevel } from '@/lib/sim/types';
import { useSim } from '@/stores/simStore';
import { SectionTitle } from './ControlPanel';

const LABELS = ['A', 'B', 'C'];

export function LevelBadge({ level }: { level: RiskLevel }) {
  const icon = level === 'aman' ? '●' : level === 'waspada' ? '▲' : level === 'siaga' ? '◆' : '■';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: LEVEL_COLOR[level], background: `${LEVEL_COLOR[level]}1f`, border: `1px solid ${LEVEL_COLOR[level]}55` }}
    >
      <span aria-hidden="true" className="text-[8px]">
        {icon}
      </span>
      {LEVEL_LABEL[level]}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-label={`Skor ${Math.round(score)} dari 100`} role="img">
      <circle cx="22" cy="22" r={r} stroke="#263041" strokeWidth="4" fill="none" />
      <circle
        cx="22"
        cy="22"
        r={r}
        stroke="#3ddc97"
        strokeWidth="4"
        fill="none"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="12" fontWeight="600" fill="#e8edf4" fontFamily="var(--font-mono)">
        {Math.round(score)}
      </text>
    </svg>
  );
}

function Briefing({ onMake }: { onMake: () => void }) {
  const briefing = useSim((s) => s.briefing);
  const state = useSim((s) => s.briefingState);
  const hasRun = useSim((s) => s.baseline !== null && s.baseline.quality === 'refined');
  const blocks: { title: string; lines: string[] }[] = [];
  if (briefing) {
    let cur: { title: string; lines: string[] } | null = null;
    for (const raw of briefing.text.split('\n')) {
      const line = raw.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
      if (!line) continue;
      const head = line.replace(/:$/, '').toUpperCase();
      if (['SITUASI', 'PRIORITAS TINDAKAN', 'CATATAN'].includes(head)) {
        cur = { title: head, lines: [] };
        blocks.push(cur);
      } else if (cur) cur.lines.push(line);
      else blocks.push((cur = { title: '', lines: [line] }));
    }
  }
  return (
    <section aria-live="polite">
      <SectionTitle>AI Briefing</SectionTitle>
      {!briefing && (
        <button
          onClick={onMake}
          disabled={!hasRun || state === 'loading'}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-card border border-wind/50 bg-wind/10 text-sm font-medium text-wind transition hover:bg-wind/20 disabled:opacity-40"
        >
          {state === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {state === 'loading' ? 'Gemini sedang menyusun briefing...' : 'Buat AI Briefing'}
        </button>
      )}
      {state === 'error' && <p className="mt-2 text-xs text-danger">Briefing gagal dibuat. Coba lagi.</p>}
      {briefing && (
        <div className="rounded-card border border-border-dark bg-bg-base/60 p-3 text-sm leading-6">
          {blocks.map((b, i) => (
            <div key={i} className="mb-2 last:mb-0">
              {b.title && <p className="text-[10.5px] font-semibold tracking-[0.12em] text-wind">{b.title}</p>}
              {b.lines.map((l, k) =>
                l.startsWith('- ') || l.startsWith('* ') ? (
                  <p key={k} className="relative pl-3 text-text-primary before:absolute before:left-0 before:content-['–']">
                    {l.slice(2)}
                  </p>
                ) : (
                  <p key={k} className="text-text-primary">
                    {l}
                  </p>
                ),
              )}
            </div>
          ))}
          <p className="mt-2 flex items-center justify-between border-t border-border-dark pt-2 text-[11px] text-text-muted">
            <span>{briefing.source === 'gemini' ? `Dibuat oleh ${briefing.model}` : 'Briefing cadangan (berbasis aturan)'}</span>
            <button onClick={onMake} className="text-wind hover:underline">
              Buat ulang
            </button>
          </p>
        </div>
      )}
    </section>
  );
}

interface Props {
  onRecommend: () => void;
  onApply: (rank: number | null) => void;
  onBriefing: () => void;
  onSave: () => void;
  saving: boolean;
}

export default function ResultsPanel({ onRecommend, onApply, onBriefing, onSave, saving }: Props) {
  const s = useSim();
  const base = s.baseline;
  const main = s.withBreak ?? base;

  if (!s.hasRun || !base || !main) {
    return (
      <div className="rounded-card border border-dashed border-border-dark p-5 text-sm leading-6 text-text-secondary">
        Belum ada simulasi. Pilih skenario, atur angin, lalu tekan <b className="text-text-primary">Jalankan simulasi</b>.
      </div>
    );
  }

  const t = s.timeStep;
  const km2Now = main.burnedByStep[Math.min(t, main.burnedByStep.length - 1)] ?? 0;
  const villages = [...main.villageRisks].sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99));
  const baseVill = new Map(base.villageRisks.map((v) => [v.villageName, v]));
  const nowHours = (t * STEP_MINUTES) / 60;

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Hasil {s.withBreak ? 'dengan sekat' : 'simulasi'}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card bg-bg-base/60 p-3">
            <p className="text-xs text-text-secondary">Luas terbakar 12 jam</p>
            <p className="font-mono text-2xl font-medium tabular">
              {nf(main.burnedKm2)}
              <span className="ml-1 text-sm text-text-secondary">km²</span>
            </p>
            {s.withBreak && (
              <p className="text-xs text-firebreak">
                −{nf(((base.burnedKm2 - s.withBreak.burnedKm2) / base.burnedKm2) * 100)}% dari tanpa sekat
              </p>
            )}
          </div>
          <div className="rounded-card bg-bg-base/60 p-3">
            <p className="text-xs text-text-secondary">Pada {stepToClock(t)}</p>
            <p className="font-mono text-2xl font-medium tabular">
              {nf(km2Now)}
              <span className="ml-1 text-sm text-text-secondary">km²</span>
            </p>
            <p className="text-xs text-text-muted">{main.quality === 'refined' ? 'animasi 1 run representatif' : 'pratinjau 1 run'}</p>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          Luas terbakar 12 jam: {nf(main.burnedKm2)} kilometer persegi.
        </p>
      </section>

      <section>
        <SectionTitle>Desa terdampak</SectionTitle>
        <ul className="space-y-1.5">
          {villages.map((v) => {
            const passed = v.etaHours !== null && v.etaHours <= nowHours;
            const b = baseVill.get(v.villageName);
            return (
              <li
                key={v.villageName}
                className="flex items-center justify-between gap-2 rounded-card border-l-4 bg-bg-base/60 px-3 py-2"
                style={{ borderColor: LEVEL_COLOR[v.level] }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{v.villageName}</p>
                  <p className="font-mono text-xs text-text-secondary">
                    {etaText(v.etaHours)}
                    {passed && <span className="ml-1 text-fire-mid">· api sudah tiba</span>}
                    {s.withBreak && b && b.etaHours !== v.etaHours && (
                      <span className="ml-1 text-firebreak">(tanpa sekat: {b.etaHours === null ? 'aman' : `${nf(b.etaHours)} j`})</span>
                    )}
                  </p>
                </div>
                <LevelBadge level={v.level} />
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionTitle>Rekomendasi sekat bakar</SectionTitle>
        {s.recState === 'idle' && (
          <button
            onClick={onRecommend}
            disabled={base.quality !== 'refined'}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-card bg-firebreak font-semibold text-bg-base transition hover:brightness-110 disabled:opacity-40"
          >
            Rekomendasikan sekat bakar
          </button>
        )}
        {s.recState === 'running' && (
          <div>
            <p className="mb-2 text-sm text-text-secondary">Menguji 225 kandidat sekat bakar...</p>
            <div className="h-2 overflow-hidden rounded-full bg-bg-base" role="progressbar" aria-valuenow={Math.round(s.recProgress * 100)}>
              <div className="h-full bg-firebreak transition-all" style={{ width: `${s.recProgress * 100}%` }} />
            </div>
          </div>
        )}
        {(s.recState === 'done' || s.recState === 'stale') && (
          <div className="space-y-2">
            {s.recState === 'stale' && (
              <div className="flex items-center justify-between gap-2 rounded-card border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                <span>Angin berubah: rekomendasi perlu dihitung ulang.</span>
                <button onClick={onRecommend} className="shrink-0 font-semibold underline">
                  Hitung ulang
                </button>
              </div>
            )}
            {s.recommendations.length === 0 && (
              <div className="flex gap-2 rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-text-primary">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
                {s.recEmptyReason}
              </div>
            )}
            <p className="text-xs text-text-muted">{s.recCandidates} kandidat diuji dengan simulasi ulang.</p>
            {s.recommendations.map((r) => {
              const applied = s.appliedRank === r.rank;
              const active = s.activeRank === r.rank;
              return (
                <article
                  key={r.rank}
                  onMouseEnter={() => s.set({ activeRank: r.rank })}
                  onFocus={() => s.set({ activeRank: r.rank })}
                  tabIndex={0}
                  className={`rounded-card border p-3 transition ${
                    applied ? 'border-firebreak bg-firebreak/10' : active ? 'border-firebreak/50 bg-bg-elevated' : 'border-border-dark bg-bg-base/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ScoreRing score={r.score} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        Sekat {LABELS[r.rank - 1]}
                        <span className="ml-2 rounded-full bg-bg-base px-1.5 py-0.5 text-[10px] text-text-secondary">#{r.rank}</span>
                      </p>
                      <dl className="mt-1 grid grid-cols-3 gap-1 font-mono text-[11px]">
                        <div>
                          <dt className="text-text-muted">Panjang</dt>
                          <dd>{nf(r.lengthKm)} km</dd>
                        </div>
                        <div>
                          <dt className="text-text-muted">Margin</dt>
                          <dd>{nf(r.marginHours)} jam</dd>
                        </div>
                        <div>
                          <dt className="text-text-muted">Luas</dt>
                          <dd className="text-firebreak">−{nf(r.reductionPct)}%</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  {r.peatBypassRisk && (
                    <p className="mt-2 text-xs leading-5 text-peat-dry">
                      Gambut kering: api dapat merambat di bawah sekat. Sertakan pembasahan atau sekat kanal.
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    {applied ? (
                      <button
                        onClick={() => onApply(null)}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-dark text-sm hover:bg-bg-elevated"
                      >
                        <Undo2 size={14} /> Batalkan sekat
                      </button>
                    ) : (
                      <button
                        onClick={() => onApply(r.rank)}
                        className="h-9 flex-1 rounded-md bg-firebreak text-sm font-semibold text-bg-base hover:brightness-110"
                      >
                        Terapkan sekat
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {s.appliedRank !== null && (
              <button
                onClick={() => s.set({ compare: !s.compare })}
                aria-pressed={s.compare}
                className={`flex h-10 w-full items-center justify-center gap-2 rounded-card border text-sm font-medium transition ${
                  s.compare ? 'border-wind bg-wind/15 text-wind' : 'border-border-dark hover:bg-bg-elevated'
                }`}
              >
                <Columns2 size={16} /> {s.compare ? 'Tutup mode bandingkan' : 'Bandingkan dengan dan tanpa sekat'}
              </button>
            )}
          </div>
        )}
      </section>

      <Briefing onMake={onBriefing} />

      <button
        onClick={onSave}
        disabled={saving || base.quality !== 'refined'}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-card border border-text-primary/70 font-semibold transition hover:bg-text-primary hover:text-bg-base disabled:opacity-40"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        {saving ? 'Menyimpan...' : 'Simpan dan buka laporan'}
      </button>
      <p className="text-[11px] leading-4 text-text-muted">
        Prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan.
      </p>
    </div>
  );
}
