export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#133a2a" />
      <path d="M9 24c0-6 3.5-10.5 9-13-1 4.5-.5 9 2 13H9z" fill="#2d7353" />
      <path
        d="M19.5 24c-2.6 0-4.5-1.9-4.5-4.3 0-2.6 2-3.8 2.8-6.2.9 1.4 1.1 2.4 1 3.4 1-.7 1.7-1.8 1.9-3 1.9 1.7 3.3 3.6 3.3 5.9 0 2.4-2 4.2-4.5 4.2z"
        fill="#f0642f"
      />
      <path d="M19.6 24c-1.2 0-2.1-.9-2.1-2 0-1.2 1-1.8 1.4-2.9.9.9 2.8 1.6 2.8 3 0 1-.9 1.9-2.1 1.9z" fill="#ffd24a" />
      <path d="M6 8.5h9M8 11.5h5" stroke="#4fc3f7" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className={`font-display text-lg font-bold tracking-tight ${dark ? 'text-text-primary' : 'text-ink'}`}>ApiRimba AI</span>
    </span>
  );
}
