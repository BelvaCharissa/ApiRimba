'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';

const LINKS = [
  { href: '/', label: 'Beranda' },
  { href: '/peta', label: 'Peta & simulasi' },
  { href: '/cara-kerja', label: 'Cara kerja' },
];

export default function SiteHeader({ dark = false }: { dark?: boolean }) {
  const path = usePathname();
  return (
    <header
      className={`no-print relative z-30 flex h-16 shrink-0 items-center gap-3 px-4 sm:gap-6 sm:px-6 ${
        dark ? 'border-b border-line-dark bg-bg-base text-text-primary' : 'text-ink'
      }`}
    >
      <Link href="/" aria-label="ApiRimba AI, beranda" className="hidden shrink-0 rounded-md sm:block">
        <Logo dark={dark} />
      </Link>
      <nav aria-label="Navigasi utama" className="-mx-2 flex min-w-0 items-center gap-0.5 overflow-x-auto sm:mx-0 sm:gap-1">
        {LINKS.map((l) => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`relative shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
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
    </header>
  );
}
