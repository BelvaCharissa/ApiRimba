'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import AboutModal from './AboutModal';
import { IconInfo } from './icons';
import { Logo } from './Logo';

const LINKS = [
  { href: '/simulator', label: 'Simulator' },
  { href: '/dashboard', label: 'Titik panas' },
];

export default function SiteHeader({ dark = false, right }: { dark?: boolean; right?: React.ReactNode }) {
  const path = usePathname();
  const [about, setAbout] = useState(false);
  return (
    <header
      className={`no-print relative z-30 flex h-16 shrink-0 items-center gap-3 px-4 sm:gap-6 sm:px-6 ${
        dark ? 'border-b border-line-dark bg-bg-base text-text-primary' : 'text-ink'
      }`}
    >
      <Link href="/" aria-label="ApiRimba AI, beranda" className="shrink-0 rounded-md">
        <Logo dark={dark} />
      </Link>
      <nav aria-label="Navigasi utama" className="flex items-center gap-1">
        {LINKS.map((l) => {
          const active = path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`relative rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                dark
                  ? active
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                  : active
                    ? 'text-ink'
                    : 'text-ink-2 hover:bg-sunken hover:text-ink'
              }`}
            >
              {l.label}
              {active && <span className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full bg-ember" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {right}
        <button
          onClick={() => setAbout(true)}
          aria-label="Tentang model"
          className={`grid size-10 place-items-center rounded-full transition-colors ${
            dark ? 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary' : 'text-ink-2 hover:bg-sunken hover:text-ink'
          }`}
        >
          <IconInfo />
        </button>
      </div>
      <AboutModal open={about} onClose={() => setAbout(false)} dark={dark} />
    </header>
  );
}
