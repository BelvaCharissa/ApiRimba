/**
 * Set ikon ApiRimba: satu gaya (grid 20 px, garis 1,75, ujung membulat).
 * Hanya ikon yang benar-benar dipakai sebagai kontrol; bukan dekorasi.
 */
type P = { size?: number; className?: string };

function Svg({ size = 20, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 4.5v11l9-5.5z" fill="currentColor" />
  </Svg>
);
export const IconPause = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v11M13 4.5v11" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 9v4.5M10 6.5v.01" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </Svg>
);
export const IconArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M16 10H4M9 5l-5 5 5 5" />
  </Svg>
);
export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 11.5l3-3M7 9.5L5.5 11a2.83 2.83 0 004 4L11 13.5M13 10.5l1.5-1.5a2.83 2.83 0 00-4-4L9 6.5" />
  </Svg>
);
export const IconPrint = (p: P) => (
  <Svg {...p}>
    <path d="M5.5 7.5V3.5h9v4M5.5 13.5h-2v-6h13v6h-2M5.5 11.5h9v5h-9z" />
  </Svg>
);
export const IconLayers = (p: P) => (
  <Svg {...p}>
    <path d="M10 3l7 4-7 4-7-4zM3 11l7 4 7-4" />
  </Svg>
);
export const IconChevron = (p: P) => (
  <Svg {...p}>
    <path d="M6 8l4 4 4-4" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </Svg>
);
export const IconSort = (p: P) => (
  <Svg {...p}>
    <path d="M6 4v12M3 13l3 3 3-3M14 16V4M11 7l3-3 3 3" />
  </Svg>
);
export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M7 5L3.5 8.5 7 12M4 8.5h7.5a4.5 4.5 0 010 9H9" />
  </Svg>
);
export const IconSplit = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="14" height="12" rx="2" />
    <path d="M10 4v12" />
  </Svg>
);
