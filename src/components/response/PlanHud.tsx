"use client";

import { type ReactNode, useEffect, useState } from "react";
import { IconChevron, IconPause, IconPlay } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/primitives";
import { nf } from "@/lib/format";
import { KIND_COLOR, KIND_GROUP } from "@/lib/response/assets";
import type { PlanFrame } from "@/lib/response/frame";
import { fmtH } from "@/lib/response/plan";
import type { PhaseId, ResponsePlan } from "@/lib/response/types";
import { useSim } from "@/stores/simStore";
import { t as tr } from '@/lib/i18n';

export const PHASE_COLOR: Record<PhaseId, string> = {
  pengerahan: "#1f63c6",
  serangan: "#d9481c",
  pendinginan: "#a16207",
  patroli: "#0f8a57",
};

/** Jam rencana per detik pada kecepatan 1x. */
const HOURS_PER_SEC = 2;

/** Pemutar rencana: putar/jeda, bilah fase, kecepatan. */
export function PlanScrubber({ plan }: { plan: ResponsePlan }) {
  const t = useSim((s) => s.planTime);
  const playing = useSim((s) => s.planPlaying);
  const speed = useSim((s) => s.planSpeed);
  const set = useSim((s) => s.set);
  const end = plan.endH;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const cur = useSim.getState().planTime;
      const next = cur + dt * HOURS_PER_SEC * useSim.getState().planSpeed;
      if (next >= end) {
        useSim.getState().set({ planTime: end, planPlaying: false });
        return;
      }
      useSim.getState().set({ planTime: next });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, end]);

  const toggle = () => {
    if (!playing && t >= end) set({ planTime: 0, planPlaying: true });
    else set({ planPlaying: !playing });
  };

  const stops = plan.phases
    .map(
      (p) =>
        `${PHASE_COLOR[p.id]} ${(p.t0 / end) * 100}% ${(p.t1 / end) * 100}%`,
    )
    .join(",");

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <button
        onClick={toggle}
        aria-label={playing ? "Jeda animasi rencana" : "Putar animasi rencana"}
        className="grid size-11 shrink-0 place-items-center rounded-full grad-sun transition-colors hover:brightness-105 active:translate-y-px"
      >
        {playing ? <IconPause /> : <IconPlay />}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          className="range w-full"
          min={0}
          max={end}
          step={0.25}
          value={t}
          aria-label={tr('Time since the plan was approved', 'Waktu sejak rencana disetujui')}
          aria-valuetext={tr(`${fmtH(t)} since the plan was approved`, `${fmtH(t)} sejak rencana disetujui`)}
          onChange={(e) =>
            set({ planTime: Number(e.target.value), planPlaying: false })
          }
          onKeyDown={(e) => {
            if (e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          style={{
            ["--track" as string]: `linear-gradient(90deg,${stops})`,
            ["--thumb" as string]: "#ffd24a",
          }}
        />
        <div
          className="relative hidden h-4 text-[11px] text-text-muted sm:block"
          aria-hidden="true"
        >
          {plan.phases.map((p) => (
            <span
              key={p.id}
              className="absolute top-0 truncate pr-1"
              style={{
                left: `${(p.t0 / end) * 100}%`,
                width: `${((p.t1 - p.t0) / end) * 100}%`,
              }}
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>
      <output className="num w-[68px] shrink-0 text-right text-lg font-semibold">
        {fmtH(t)}
      </output>
      <Segmented
        label={tr('Plan playback speed', 'Kecepatan putar rencana')}
        size="sm"
        value={speed}
        onChange={(v) => set({ planSpeed: v })}
        options={[
          { value: 1 as const, label: "1x" },
          { value: 2 as const, label: "2x" },
          { value: 4 as const, label: "4x" },
        ]}
        className="hidden w-[120px] shrink-0 sm:grid"
      />
    </div>
  );
}

/** Narasi fase yang sedang berjalan, di atas peta. */
export function PlanNarration({
  plan,
  frame,
}: {
  plan: ResponsePlan;
  frame: PlanFrame;
}) {
  const approval = useSim((s) => s.approval);
  const approved = approval?.planId === plan.id;
  const idx = plan.phases.findIndex((p) => p.id === frame.phase.id);
  return (
    <section
      aria-live="polite"
      className="glass w-[min(380px,calc(100vw-32px))] rounded-[16px] p-3.5 shadow-float"
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
        <span className="text-text-muted">{tr('Operation plan animation', 'Animasi rencana operasi')}</span>
        {approved ? (
          <span className="rounded-[6px] bg-[#2fb67c]/20 px-1.5 py-0.5 text-ok-ink">
            {tr('Approved', 'Disetujui')}
          </span>
        ) : (
          <span className="rounded-[6px] bg-sun/15 px-1.5 py-0.5 text-sun">
            {tr('Plan only, not dispatched', 'Rencana, belum dikerahkan')}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold leading-tight">
          <span
            className="mr-1.5 inline-block size-2.5 rounded-full align-middle"
            style={{ background: PHASE_COLOR[frame.phase.id] }}
          />
          {frame.phase.title}
        </h3>
        <span className="num shrink-0 text-xs text-text-muted">
          {tr('Phase', 'Fase')} {idx + 1}/{plan.phases.length}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-5 text-text-secondary">
        {frame.phase.text}
      </p>
      <dl className="num mt-2.5 grid grid-cols-3 gap-2 border-t border-line-dark pt-2.5 text-xs">
        <div>
          <dt className="text-text-muted">{tr('Time', 'Waktu')}</dt>
          <dd className="text-sm font-semibold">{fmtH(frame.t)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">{tr('Fire area', 'Luas api')}</dt>
          <dd className="text-sm font-semibold">{nf(frame.areaKm2)} km²</dd>
        </div>
        <div>
          <dt className="text-text-muted">{tr('Control line', 'Garis kendali')}</dt>
          <dd className="text-sm font-semibold">{frame.builtPct}%</dd>
        </div>
      </dl>
    </section>
  );
}

/** Legenda simbol rencana. */
export function PlanLegend() {
  const [open, setOpen] = useState(false);
  const row = (sw: ReactNode, label: string) => (
    <li className="flex items-center gap-2">
      <span className="flex w-6 shrink-0 justify-center">{sw}</span>
      {label}
    </li>
  );
  const ln = (color: string, dash = false, w = 3) => (
    <svg width="24" height="8" aria-hidden="true">
      <line
        x1="1"
        y1="4"
        x2="23"
        y2="4"
        stroke={color}
        strokeWidth={w}
        strokeDasharray={dash ? "4 3" : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
  return (
    <section
      aria-label={tr('Plan legend', 'Legenda rencana')}
      className="glass w-60 rounded-[16px] text-xs shadow-float"
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between px-3 text-[11px] font-bold uppercase tracking-wide text-text-muted"
      >
        {tr('Plan legend', 'Legenda rencana')}
        <IconChevron
          size={16}
          className={`transition-transform ${open ? "" : "rotate-180"}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3">
          <ul className="space-y-1.5">
            {row(ln("#4ade80", false, 4), tr('Control line built', 'Garis kendali terbangun'))}
            {row(ln("#c92a2a", true), tr('Control line not yet built', 'Garis kendali belum terbangun'))}
            {row(ln("#1c7ed6", true), tr('Water supply route (shuttle)', 'Rute pasok air (bolak-balik)'))}
            {row(ln("#6d28d9", true), tr('Helicopter refill route', 'Rute helikopter isi air'))}
            {row(ln("#b45309", true), tr('Command post supply route', 'Jalur logistik posko'))}
            {row(ln("#c4d0c7", true, 2), tr('Unit route (indicative, straight line)', 'Rute unit (indikatif, garis lurus)'))}
            {row(
              <span className="size-3 rounded-full border-2 border-white bg-[#1c7ed6] shadow" />,
              tr('Water source', 'Sumber air'),
            )}
          </ul>
          <h3 className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wide text-text-muted">
            {tr('Units', 'Unit')}
          </h3>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
            {KIND_GROUP.map((k) => (
              <li key={k.key} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: KIND_COLOR[k.key] }}
                />
                <span className="truncate">{k.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-4 text-text-muted">
            {tr('Faded unit: standby, reserve, or busy elsewhere.', 'Unit pudar: siaga, cadangan, atau bertugas di tempat lain.')}
          </p>
        </div>
      )}
    </section>
  );
}
