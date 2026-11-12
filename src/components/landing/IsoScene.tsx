/**
 * Ilustrasi isometrik lanskap gambut: hutan, desa, sungai, api yang menjalar searah angin,
 * dan sekat bakar. Seluruhnya SVG buatan sendiri (tanpa aset eksternal).
 */

const N = 11;
const TW = 58;
const TH = 29;
const OX = 330;
const OY = 70;
const SLAB = 26;

type Tile = 'forest' | 'peat' | 'river' | 'burned' | 'fire' | 'break' | 'village' | 'field';

function rand(i: number, j: number, k = 0) {
  const x = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

function tileAt(i: number, j: number): Tile {
  // sungai melintang
  if (j === 9 || (j === 8 && i > 7)) return 'river';
  // sekat bakar (garis hijau) di depan api
  if (i === 6 && j >= 1 && j <= 6) return 'break';
  // desa
  if ((i === 8 && (j === 2 || j === 3)) || (i === 9 && j === 5) || (i === 2 && j === 7)) return 'village';
  // api: dari titik (2,3) menjalar ke arah +i (searah angin)
  const di = i - 2;
  const dj = j - 3;
  const d = Math.hypot(di * 0.62, dj);
  if (di >= -1 && d < 2.1 && i <= 5) return d < 1.1 ? 'burned' : 'fire';
  if (i <= 5 && i >= 4 && j >= 2 && j <= 4) return 'fire';
  // gambut
  if (Math.hypot(i - 3.5, j - 3.5) < 3.4) return 'peat';
  if (rand(i, j) < 0.18) return 'field';
  return 'forest';
}

const TOP: Record<Tile, string> = {
  forest: '#cfe3c6',
  peat: '#e3cfa8',
  river: '#9fd0ea',
  burned: '#6b4a3e',
  fire: '#ffb48a',
  break: '#8fe0b9',
  village: '#e9ece4',
  field: '#e6e9c6',
};

function iso(i: number, j: number): [number, number] {
  return [OX + (i - j) * (TW / 2), OY + (i + j) * (TH / 2)];
}

function diamond(i: number, j: number) {
  const [x, y] = iso(i, j);
  return `${x},${y} ${x + TW / 2},${y + TH / 2} ${x},${y + TH} ${x - TW / 2},${y + TH / 2}`;
}

function Tree({ x, y, s, tone }: { x: number; y: number; s: number; tone: number }) {
  const greens = ['#2f7a57', '#3b8c63', '#24654a'];
  const g = greens[tone % 3];
  return (
    <g>
      <ellipse cx={x} cy={y + 2} rx={7 * s} ry={3 * s} fill="#10291f" opacity="0.15" />
      <rect x={x - 1.2} y={y - 6 * s} width={2.4} height={7 * s} fill="#7a5a3a" />
      <path d={`M${x} ${y - 26 * s} L${x + 9 * s} ${y - 5 * s} L${x - 9 * s} ${y - 5 * s}Z`} fill={g} />
      <path d={`M${x} ${y - 26 * s} L${x + 9 * s} ${y - 5 * s} L${x} ${y - 5 * s}Z`} fill="#10291f" opacity="0.18" />
    </g>
  );
}

function House({ x, y, roof }: { x: number; y: number; roof: string }) {
  const w = 13;
  const h = 10;
  return (
    <g>
      <path d={`M${x - w} ${y - 4} L${x} ${y + 2} L${x} ${y - h + 2} L${x - w} ${y - h - 4}Z`} fill="#f4f1ea" />
      <path d={`M${x} ${y + 2} L${x + w} ${y - 4} L${x + w} ${y - h - 4} L${x} ${y - h + 2}Z`} fill="#d9d4c7" />
      <path d={`M${x - w - 1} ${y - h - 4} L${x - 2} ${y - h - 16} L${x + w + 1} ${y - h - 4} L${x} ${y - h + 3}Z`} fill={roof} />
      <rect x={x + 4} y={y - 9} width={3.5} height={4.5} fill="#5a6b60" transform={`skewY(-25 ${x} ${y})`} />
    </g>
  );
}

function Flame({ x, y, s, delay }: { x: number; y: number; s: number; delay: number }) {
  return (
    <g style={{ transformOrigin: `${x}px ${y}px`, animation: `flicker ${0.9 + delay * 0.4}s ease-in-out ${delay}s infinite` }}>
      <path
        d={`M${x} ${y - 22 * s} C${x + 9 * s} ${y - 12 * s} ${x + 8 * s} ${y} ${x} ${y} C${x - 8 * s} ${y} ${x - 9 * s} ${y - 10 * s} ${x - 2 * s} ${y - 16 * s} C${x - 1 * s} ${y - 10 * s} ${x + 2 * s} ${y - 9 * s} ${x} ${y - 22 * s}Z`}
        fill="#ff6a3d"
      />
      <path
        d={`M${x} ${y - 12 * s} C${x + 4 * s} ${y - 7 * s} ${x + 4 * s} ${y} ${x} ${y} C${x - 4 * s} ${y} ${x - 4 * s} ${y - 5 * s} ${x} ${y - 12 * s}Z`}
        fill="#ffd24a"
      />
    </g>
  );
}

export default function IsoScene() {
  const tiles: { i: number; j: number; t: Tile }[] = [];
  for (let s = 0; s < 2 * N - 1; s++) {
    for (let i = 0; i < N; i++) {
      const j = s - i;
      if (j >= 0 && j < N) tiles.push({ i, j, t: tileAt(i, j) });
    }
  }
  // sisi slab tanah
  const [lx, ly] = iso(0, N);
  const [bx, by] = iso(N, N);
  const [rx, ry] = iso(N, 0);

  return (
    <svg viewBox="0 0 660 460" className="h-auto w-full" role="img" aria-label="Ilustrasi lanskap gambut dengan api yang menjalar searah angin, desa, dan sekat bakar">
      <defs>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff6a3d" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff6a3d" stopOpacity="0" />
        </radialGradient>

      </defs>

      {/* bayangan & slab */}
      <ellipse cx={OX} cy={by + SLAB + 10} rx={300} ry={26} fill="#10291f" opacity="0.08" />
      <path d={`M${lx} ${ly} L${bx} ${by} L${bx} ${by + SLAB} L${lx} ${ly + SLAB}Z`} fill="#8a6a4c" />
      <path d={`M${bx} ${by} L${rx} ${ry} L${rx} ${ry + SLAB} L${bx} ${by + SLAB}Z`} fill="#6e523a" />
      <path d={`M${lx} ${ly + 8} L${bx} ${by + 8} L${bx} ${by + SLAB} L${lx} ${ly + SLAB}Z`} fill="#3f2d20" opacity="0.35" />
      <path d={`M${bx} ${by + 8} L${rx} ${ry + 8} L${rx} ${ry + SLAB} L${bx} ${by + SLAB}Z`} fill="#2a1d14" opacity="0.35" />

      {/* permukaan */}
      {tiles.map(({ i, j, t }) => (
        <polygon key={`t${i}-${j}`} points={diamond(i, j)} fill={TOP[t]} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.8" />
      ))}

      {/* cahaya api */}
      {(() => {
        const [fx, fy] = iso(3.6, 3.4);
        return <ellipse cx={fx} cy={fy + TH / 2} rx={150} ry={80} fill="url(#glow)" />;
      })()}

      {/* objek: diurutkan dari belakang ke depan */}
      {tiles.map(({ i, j, t }) => {
        const [x, y0] = iso(i, j);
        const y = y0 + TH / 2;
        if (t === 'forest') {
          const n = rand(i, j, 1) < 0.5 ? 2 : 1;
          return (
            <g key={`o${i}-${j}`}>
              {Array.from({ length: n }, (_, k) => (
                <Tree
                  key={k}
                  x={x + (n === 2 ? (k === 0 ? -9 : 9) : 0)}
                  y={y + (n === 2 ? (k === 0 ? -2 : 3) : 2)}
                  s={0.8 + rand(i, j, k + 3) * 0.35}
                  tone={Math.floor(rand(i, j, k + 7) * 3)}
                />
              ))}
            </g>
          );
        }
        if (t === 'peat' && rand(i, j, 2) < 0.45) return <Tree key={`o${i}-${j}`} x={x} y={y + 2} s={0.62} tone={2} />;
        if (t === 'village') return <House key={`o${i}-${j}`} x={x} y={y + 4} roof={i === 8 && j === 2 ? '#ff8a3d' : '#2f7a57'} />;
        if (t === 'fire') return <Flame key={`o${i}-${j}`} x={x} y={y + 4} s={0.85 + rand(i, j, 5) * 0.5} delay={rand(i, j, 6)} />;
        if (t === 'burned')
          return (
            <g key={`o${i}-${j}`}>
              <rect x={x - 1.5} y={y - 14} width={3} height={15} fill="#2b1d17" />
              <rect x={x + 7} y={y - 8} width={2.5} height={10} fill="#2b1d17" />
            </g>
          );
        return null;
      })}

      {/* angin */}
      <g stroke="#0b6d99" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.75">
        {[
          [70, 150, 120],
          [40, 205, 150],
          [96, 255, 110],
        ].map(([x, y, len], k) => (
          <path
            key={k}
            d={`M${x} ${y} q ${len / 2} ${len * 0.12} ${len} ${len * 0.5}`}
            strokeDasharray="22 18"
            style={{ animation: `wind-dash ${1.6 + k * 0.3}s linear infinite` }}
          />
        ))}
      </g>
    </svg>
  );
}
