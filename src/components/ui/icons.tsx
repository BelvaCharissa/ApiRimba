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
export const IconTarget = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6" />
    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    <path d="M10 1.5V4M10 16v2.5M1.5 10H4M16 10h2.5" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M12 5l-5 5 5 5" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M8 5l5 5-5 5" />
  </Svg>
);
export const IconFlame = (p: P) => (
  <Svg {...p}>
    <path d="M10 2c1 3 4 4.5 4 8.5A4 4 0 0 1 6 10.5c0-1.6.8-2.6 1.6-3.4.2 1.2.9 2 1.7 2.2C9 7 9.2 4.6 10 2z" />
  </Svg>
);
export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M10 18s5.5-5 5.5-9.5a5.5 5.5 0 0 0-11 0C4.5 13 10 18 10 18z" />
    <circle cx="10" cy="8.5" r="2" />
  </Svg>
);
export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3 9.5 10 3.5l7 6V17h-4.5v-5h-5v5H3z" />
  </Svg>
);
export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M16 4v4h-4M4 16v-4h4" />
    <path d="M15.5 8A6 6 0 0 0 4.7 6.5M4.5 12a6 6 0 0 0 10.8 1.5" />
  </Svg>
);
export const IconWind = (p: P) => (
  <Svg {...p}>
    <path d="M3 7.5h9a2.5 2.5 0 1 0-2.5-2.5M3 12.5h12a2.5 2.5 0 1 1-2.5 2.5M3 10h6" />
  </Svg>
);
export const IconChat = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5h12v8H9l-3.5 3v-3H4z" />
    <path d="M7 9h6M7 11.5h4" />
  </Svg>
);
export const IconSend = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10l13-6-4.5 13-2.5-5.5z" />
    <path d="M9.5 11.5L16.5 4" />
  </Svg>
);
export const IconCamera = (p: P) => (
  <Svg {...p}>
    <path d="M3 7h3l1.5-2h5L14 7h3v9H3z" />
    <circle cx="10" cy="11.5" r="2.75" />
  </Svg>
);
export const IconHand = (p: P) => (
  <Svg {...p}>
    <path d="M3 13.5h3l4 2.5c1 .5 2 .4 2.8-.2l4.2-3.3c.6-.5.5-1.4-.2-1.7-.4-.2-.9-.2-1.3.1L13 12.3" />
    <path d="M6 12.5l2.5-1.5h3.2c.7 0 1.2.5 1.2 1.1s-.5 1.1-1.2 1.1H9.5" />
    <path d="M12.5 4.2c.6-.9 2.2-.9 2.6.3.5 1.4-1.6 2.9-2.6 3.5-1-.6-3.1-2.1-2.6-3.5.4-1.2 2-1.2 2.6-.3z" />
  </Svg>
);
export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M2.75 10h14.5M10 2.75c2 2 2.9 4.4 2.9 7.25S12 15.25 10 17.25C8 15.25 7.1 12.85 7.1 10S8 4.75 10 2.75z" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M10 3l7.5 13h-15z" />
    <path d="M10 8.5v3.5M10 14.25v.01" />
  </Svg>
);
