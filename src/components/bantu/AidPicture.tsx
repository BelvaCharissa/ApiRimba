import type { AidType } from '@/lib/aid';

/** Ilustrasi datar tiap jenis bantuan, satu gaya: latar hijau tua, benda terang, aksen oranye logo. */
export default function AidPicture({ type, className = '' }: { type: AidType; className?: string }) {
  return (
    <svg viewBox="0 0 160 110" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`bg-${type}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#173f28" />
          <stop offset="1" stopColor="#2c5a1f" />
        </linearGradient>
      </defs>
      <rect width="160" height="110" rx="14" fill={`url(#bg-${type})`} />
      <ellipse cx="80" cy="94" rx="52" ry="6" fill="#000" opacity="0.18" />
      {type === 'masks' && (
        <g>
          <path d="M40 48c12-14 68-14 80 0v14c-6 18-22 26-40 26S46 80 40 62z" fill="#f3f6ef" />
          <path d="M48 52c10-8 54-8 64 0M48 62c10 6 54 6 64 0M50 72c10 6 50 6 60 0" stroke="#c4d0c7" strokeWidth="2" fill="none" />
          <path d="M40 50c-10 0-16 6-16 12s5 10 14 8M120 50c10 0 16 6 16 12s-5 10-14 8" stroke="#f3f6ef" strokeWidth="3" fill="none" />
          <circle cx="80" cy="66" r="6" fill="#ff9a3c" />
        </g>
      )}
      {type === 'water' && (
        <g>
          <rect x="44" y="34" width="44" height="58" rx="8" fill="#4fb8f0" />
          <rect x="56" y="24" width="20" height="12" rx="3" fill="#f3f6ef" />
          <rect x="50" y="50" width="32" height="18" rx="3" fill="#f3f6ef" opacity="0.9" />
          <path d="M60 59h12" stroke="#4fb8f0" strokeWidth="3" />
          <rect x="94" y="48" width="26" height="44" rx="6" fill="#8fd0f5" />
          <rect x="101" y="40" width="12" height="9" rx="2" fill="#f3f6ef" />
          <path d="M107 62c-4 6-6 9-6 12a6 6 0 0 0 12 0c0-3-2-6-6-12z" fill="#f3f6ef" />
        </g>
      )}
      {type === 'food' && (
        <g>
          <path d="M36 46l44-14 44 14-44 14z" fill="#ffd24a" />
          <path d="M36 46v32l44 14V60z" fill="#e8b53a" />
          <path d="M124 46v32l-44 14V60z" fill="#f2c447" />
          <path d="M58 39l44 14v10" stroke="#c48a1c" strokeWidth="4" fill="none" />
          <rect x="88" y="68" width="22" height="10" rx="2" fill="#f3f6ef" transform="skewY(-18)" />
        </g>
      )}
      {type === 'medical' && (
        <g>
          <rect x="42" y="38" width="76" height="52" rx="8" fill="#f3f6ef" />
          <rect x="66" y="28" width="28" height="12" rx="4" fill="none" stroke="#f3f6ef" strokeWidth="5" />
          <rect x="42" y="52" width="76" height="6" fill="#dfe6e0" />
          <path d="M80 54v26M67 67h26" stroke="#e8431c" strokeWidth="9" strokeLinecap="round" />
        </g>
      )}
      {type === 'equipment' && (
        <g>
          <rect x="34" y="52" width="46" height="34" rx="6" fill="#e8431c" />
          <rect x="40" y="44" width="30" height="10" rx="3" fill="#ff9a3c" />
          <circle cx="57" cy="69" r="9" fill="#2b1b14" />
          <circle cx="57" cy="69" r="4" fill="#ff9a3c" />
          <path d="M80 66c22 0 18-26 40-26 10 0 12 8 6 12" stroke="#f3f6ef" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M124 50l10-6" stroke="#4fb8f0" strokeWidth="4" strokeLinecap="round" />
          <path d="M136 40c4 2 6 6 4 10M138 34c7 3 10 11 7 18" stroke="#4fb8f0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      )}
      {type === 'shelter' && (
        <g>
          <path d="M28 90L80 26l52 64z" fill="#8fd14f" />
          <path d="M80 26l52 64H96z" fill="#5fa53a" />
          <path d="M80 50L64 90h32z" fill="#173f28" />
          <path d="M80 26V90" stroke="#f3f6ef" strokeWidth="2" opacity="0.6" />
          <path d="M22 90h116" stroke="#f3f6ef" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
