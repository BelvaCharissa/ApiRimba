'use client';

import { Info } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import AboutModal from './AboutModal';
import { Logo } from './Logo';

const LINKS = [
  { href: '/simulator', label: 'Simulator' },
  { href: '/dashboard', label: 'Dashboard' },
];

export default function SiteHeader({ dark = false, right }: { dark?: boolean; right?: React.ReactNode }) {
  const path = usePathname();
  const [about, setAbout] = useState(false);
  return (
    <header
      className={`no-print relative z-30 flex h-14 items-center gap-4 px-4 sm:px-6 ${
        dark ? 'border-b border-border-dark bg-bg-base/95 text-text-primary' : 'bg-transparent text-ink'
      }`}
    >
      <Link href="/" aria-label="ApiRimba AI, beranda" className="shrink-0">
        <Logo dark={dark} />
      </Link>
      <nav aria-label="Navigasi utama" className="ml-2 flex items-center gap-1">
        {LINKS.map((l) => {
          const active = path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                dark
                  ? active
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                  : active
                    ? 'bg-forest-900 text-white'
                    : 'text-ink-2 hover:bg-white hover:text-ink'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {right}
        <button
          onClick={() => setAbout(true)}
          aria-label="Tentang model"
          className={`grid size-9 place-items-center rounded-full transition ${
            dark ? 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary' : 'text-ink-2 hover:bg-white'
          }`}
        >
          <Info size={18} />
        </button>
      </div>
      <AboutModal open={about} onClose={() => setAbout(false)} dark={dark} />
    </header>
  );
}
