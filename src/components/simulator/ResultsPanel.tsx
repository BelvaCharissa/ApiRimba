'use client';

import { IconCheck, IconSplit, IconUndo } from '@/components/ui/icons';
import { Button, LiveNumber, Segmented, StatusBadge, Switch } from '@/components/ui/primitives';
import { nf, stepToClock } from '@/lib/format';
import { STEP_MINUTES } from '@/lib/sim/params';
import { useSim } from '@/stores/simStore';

const LABELS = ['A', 'B', 'C'];

/* ---------------- Tab: Dampak ---------------- */
function ImpactTab() {
  const s = useSim();
  const base = s.baseline!;
  const main = s.withBreak ?? base;
  const t = s.timeStep;
  const nowHours = (t * STEP_MINUTES) / 60;
  const villages = [...main.villageRisks].sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99));
  const first = villages.find((v) => v.etaHours !== null);
  const baseVill = new Map(base.villageRisks.map((v) => [v.villageName, v]));
  const km2Now = main.burnedByStep[Math.min(t, main.burnedByStep.length - 1)] ?? 0;

  return (
    <div className="space-y-5">
      <header>
        <p className="font-display text-[34px] font-bold leading-none tracking-tight">
          <LiveNumber value={`${nf(main.burnedKm2)} km²`} />
        </p>
        <h2 className="mt-2 text-[15px] font-semibold leading-6">
          area diperkirakan terbakar dalam 12 jam{s.withBreak ? ' dengan sekat' : ''}
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {first
            ? `${first.villageName} terjangkau lebih dulu, sekitar ${nf(first.etaHours ?? 0)} jam lagi.`
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
        <span className="text-text-secondary">Terbakar pada {stepToClock(t)}</span>
        <span className="num font-semibold">{nf(km2Now)} km²</span>
      </div>

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
              <li key={v.villageName} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{v.villageName}</p>
                  <p className="num text-sm text-text-secondary">
                    {v.etaHours === null ? 'Tidak terjangkau 12 jam' : arrived ? 'Api sudah tiba' : `Tiba ${nf(v.etaHours)} jam lagi`}
                    {changed && <span className="text-text-muted"> (tanpa sekat {b.etaHours === null ? 'aman' : `${nf(b.etaHours)} jam`})</span>}
                  </p>
                </div>
                <StatusBadge level={v.level} />
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs leading-5 text-text-muted">
        Prediksi simulasi dari 12 kali run. Angka dapat berbeda di lapangan; gunakan sebagai dukungan keputusan.
      </p>
    </div>
  );
}

/* ---------------- Tab: Sekat bakar ---------------- */
function BreakTab({ onRecommend, onApply }: { onRecommend: () => void; onApply: (rank: number | null) => void }) {
  const s = useSim();
  const ready = s.baseline?.quality === 'refined';
  const best = s.recommendations[0];

  if (s.recState === 'idle') {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Di mana sekat bakar paling efektif?</h2>
        <p className="text-sm leading-6 text-text-secondary">
          Sistem menguji ratusan garis sekat di depan api, mensimulasikan ulang tiap garis, lalu memilih tiga yang paling
          menurunkan risiko dan masih sempat dibangun dalam 4 jam.
        </p>
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
              Garis {nf(best.lengthKm)} km, masih sempat dibangun dengan sisa waktu {nf(best.marginHours)} jam sebelum api tiba.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Tidak ada sekat yang sempat dibangun</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{s.recEmptyReason}</p>
          </>
        )}
      </header>

      {s.recState === 'stale' && (
        <div className="flex items-center justify-between gap-3 rounded-[8px] bg-bg-base p-3 text-sm">
          <span className="text-text-secondary">Kondisi berubah sejak sekat dihitung.</span>
          <Button tone="dark" variant="secondary" size="sm" onClick={onRecommend}>
            Hitung ulang
          </Button>
        </div>
      )}

      <ul className="space-y-2">
        {s.recommendations.map((r) => {
          const applied = s.appliedRank === r.rank;
          const active = s.activeRank === r.rank;
          return (
            <li key={r.rank}>
              <article
                onMouseEnter={() => s.set({ activeRank: r.rank })}
                onFocus={() => s.set({ activeRank: r.rank })}
                tabIndex={0}
                aria-label={`Sekat ${LABELS[r.rank - 1]}`}
                className={`rounded-[8px] p-3 transition-colors ${applied ? 'bg-bg-hover' : active ? 'bg-bg-elevated' : 'bg-bg-base'}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-semibold">
                    Sekat {LABELS[r.rank - 1]}
                    {applied && (
                      <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-firebreak">
                        <IconCheck size={14} /> Diterapkan
                      </span>
                    )}
                  </h3>
                  <span className="num text-sm text-text-secondary">skor {nf(r.score, 0)}</span>
                </div>
                <dl className="num mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-text-muted">Area terbakar</dt>
                    <dd className="font-semibold">−{nf(r.reductionPct)}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Sisa waktu</dt>
                    <dd className="font-semibold">{nf(r.marginHours)} jam</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Panjang</dt>
                    <dd className="font-semibold">{nf(r.lengthKm)} km</dd>
                  </div>
                </dl>
                {r.peatBypassRisk && (
                  <p className="mt-2 text-sm leading-5 text-text-secondary">
                    Melintasi gambut kering: sertakan pembasahan atau sekat kanal agar api bawah tanah tidak lolos.
                  </p>
                )}
                <div className="mt-3">
                  {applied ? (
                    <Button tone="dark" variant="secondary" size="sm" className="w-full" onClick={() => onApply(null)}>
                      <IconUndo size={16} /> Batalkan
                    </Button>
                  ) : (
                    <Button tone="dark" variant={r.rank === 1 && s.appliedRank === null ? 'primary' : 'secondary'} size="sm" className="w-full" onClick={() => onApply(r.rank)}>
                      Terapkan Sekat {LABELS[r.rank - 1]}
                    </Button>
                  )}
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
function BriefTab({ onBriefing, onSave, saving }: { onBriefing: () => void; onSave: () => void; saving: boolean }) {
  const s = useSim();
  const ready = s.baseline?.quality === 'refined';
  const blocks: { title: string; lines: string[] }[] = [];
  if (s.briefing) {
    let cur: { title: string; lines: string[] } | null = null;
    for (const raw of s.briefing.text.split('\n')) {
      const line = raw.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
      if (!line) continue;
      const head = line.replace(/:$/, '').toUpperCase();
      if (['SITUASI', 'PRIORITAS TINDAKAN', 'CATATAN'].includes(head)) {
        cur = { title: head.charAt(0) + head.slice(1).toLowerCase(), lines: [] };
        blocks.push(cur);
      } else if (cur) cur.lines.push(line);
      else blocks.push((cur = { title: '', lines: [line] }));
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">Briefing untuk posko</h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Gemini merangkum hasil simulasi{s.appliedRank ? ' dan sekat yang diterapkan' : ''} menjadi situasi dan prioritas tindakan.
        </p>
      </header>

      {!s.briefing && (
        <Button tone="dark" className="w-full" onClick={onBriefing} disabled={!ready} loading={s.briefingState === 'loading'}>
          {s.briefingState === 'loading' ? 'Menyusun briefing...' : 'Susun briefing'}
        </Button>
      )}
      {s.briefingState === 'error' && <p className="text-sm text-danger">Briefing gagal disusun. Coba lagi.</p>}

      {s.briefing && (
        <article className="rounded-[8px] bg-bg-base p-4 text-[15px] leading-7" aria-live="polite">
          {blocks.map((b, i) => (
            <section key={i} className="mb-3 last:mb-0">
              {b.title && <h3 className="text-sm font-semibold text-wind">{b.title}</h3>}
              {b.lines.map((l, k) =>
                /^[-*]\s/.test(l) ? (
                  <p key={k} className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:size-1.5 before:rounded-full before:bg-text-muted">
                    {l.slice(2)}
                  </p>
                ) : (
                  <p key={k}>{l}</p>
                ),
              )}
            </section>
          ))}
          <footer className="mt-3 flex items-center justify-between border-t border-line-dark pt-3 text-sm text-text-muted">
            <span>{s.briefing.source === 'gemini' ? `Disusun oleh ${s.briefing.model}` : 'Disusun dengan aturan tetap'}</span>
            <button onClick={onBriefing} className="font-semibold text-text-secondary hover:text-text-primary">
              Susun ulang
            </button>
          </footer>
        </article>
      )}

      <div className="border-t border-line-dark pt-5">
        <h3 className="text-[15px] font-semibold">Bagikan ke BPBD</h3>
        <p className="mt-1 text-sm leading-6 text-text-secondary">Simpan hasil ini sebagai laporan satu halaman yang bisa dicetak dan dibagikan lewat tautan.</p>
        <Button tone="dark" variant={s.briefing ? 'primary' : 'secondary'} className="mt-3 w-full" onClick={onSave} disabled={!ready} loading={saving}>
          {saving ? 'Menyimpan laporan...' : 'Simpan laporan'}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Panel hasil bertab ---------------- */
interface Props {
  onRecommend: () => void;
  onApply: (rank: number | null) => void;
  onBriefing: () => void;
  onSave: () => void;
  saving: boolean;
  hideTabs?: boolean;
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
          { value: 'briefing', label: 'Briefing' },
        ]}
        className="mb-5"
      />
      )}
      {!has ? (
        <ResultsSkeleton />
      ) : tab === 'dampak' ? (
        <ImpactTab />
      ) : tab === 'sekat' ? (
        <BreakTab onRecommend={props.onRecommend} onApply={props.onApply} />
      ) : (
        <BriefTab onBriefing={props.onBriefing} onSave={props.onSave} saving={props.saving} />
      )}
    </div>
  );
}
