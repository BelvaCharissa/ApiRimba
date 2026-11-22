'use client';

import type { ComponentProps, ReactNode } from 'react';
import SiteHeader from '@/components/ui/SiteHeader';

/** Kerangka halaman akun (masuk, daftar, sandi): header yang sama, satu panel kaca di tengah. */
export default function AuthShell({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-[#07140d]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="auth-orb auth-orb-a absolute -left-28 top-16 size-[340px] rounded-full bg-[#9be15d]/10 blur-3xl" />
        <div className="auth-orb auth-orb-b absolute -right-24 bottom-8 size-[420px] rounded-full bg-[#ffd24a]/10 blur-3xl" />
        <div className="auth-grid absolute inset-0 opacity-30" />
      </div>
      <SiteHeader cta={false} />
      <main className="relative mx-auto grid min-h-[calc(100dvh-64px)] max-w-[1120px] place-items-center gap-8 px-4 pb-16 pt-8 sm:px-6 md:grid-cols-[1fr_460px] md:pb-8">
        <div className="auth-copy max-md:hidden">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-[#d9e7dc]">
            <span className="size-2 rounded-full bg-[#9be15d] shadow-[0_0_18px_rgba(155,225,93,.75)]" />
            {eyebrow}
          </div>
          <h1 className="mt-5 max-w-[520px] text-5xl font-bold leading-[1.04] tracking-tight text-white">{title}</h1>
          {lead && <p className="mt-5 max-w-[480px] text-lg leading-8 text-[#b9c8be]">{lead}</p>}
          <div className="mt-8 flex gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-[#d9e7dc]">2 roles</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-[#d9e7dc]">Live NASA data</span>
          </div>
        </div>
        <div className="auth-card w-full max-w-[460px]">
          <div className="md:hidden">
            <p className="text-sm font-semibold text-leaf">{eyebrow}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{title}</h1>
          </div>
          <div className="glass mt-5 rounded-[24px] border border-white/10 p-5 shadow-[0_24px_80px_rgba(0,0,0,.38)] backdrop-blur-xl sm:p-7 md:mt-0">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function Field({ label, hint, ...input }: { label: string; hint?: string } & ComponentProps<'input'>) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        {...input}
        className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-black/25 px-3 text-ink placeholder:text-ink-3 focus:border-sun focus:outline-none"
      />
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-[12px] bg-danger/15 px-3 py-2 text-sm text-danger-ink">
      {children}
    </p>
  );
}

export function FormNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-[12px] bg-ok/15 px-3 py-2 text-sm text-ok-ink">
      {children}
    </p>
  );
}
