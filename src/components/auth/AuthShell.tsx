'use client';

import type { ComponentProps, ReactNode } from 'react';
import SiteHeader from '@/components/ui/SiteHeader';

/** Kerangka halaman akun (masuk, daftar, sandi): header yang sama, satu panel kaca di tengah. */
export default function AuthShell({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="grad-canopy min-h-dvh">
      <SiteHeader cta={false} />
      <main className="mx-auto grid max-w-[1200px] gap-10 px-4 pb-20 pt-8 sm:px-6 md:grid-cols-[1fr_440px] md:items-start md:pt-16">
        <div className="max-md:hidden">
          <p className="text-sm font-semibold text-leaf">{eyebrow}</p>
          <h1 className="mt-2 max-w-[520px] text-5xl font-bold leading-[1.05] tracking-tight text-ink">{title}</h1>
          {lead && <p className="mt-4 max-w-[480px] text-lg leading-7 text-ink-2">{lead}</p>}
        </div>
        <div>
          <div className="md:hidden">
            <p className="text-sm font-semibold text-leaf">{eyebrow}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{title}</h1>
          </div>
          <div className="glass mt-5 rounded-[20px] p-5 sm:p-6 md:mt-0">{children}</div>
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
