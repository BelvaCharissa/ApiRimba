'use client';

import type { Map as MlMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

interface Props {
  windMs: number;
  windFromDeg: number;
  enabled: boolean;
  map?: MlMap | null;
  /** Jumlah partikel (default 700, mode ringan 400). */
  count?: number;
  color?: string;
  onLowFps?: () => void;
}

/**
 * Partikel angin di kanvas di atas peta. Arah mengikuti angin (dikoreksi bearing peta),
 * kecepatan sebanding kecepatan angin, jejak memudar. Berhenti bila reduced motion.
 * Warna bawaan biru muda terang (token wind) agar terlihat di atas citra satelit yang gelap.
 */
export default function WindParticles({ windMs, windFromDeg, enabled, map, count = 700, color = '124,199,238', onLowFps }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const windRef = useRef({ windMs, windFromDeg });
  const lowFpsRef = useRef(onLowFps);
  useEffect(() => {
    windRef.current = { windMs, windFromDeg };
    lowFpsRef.current = onLowFps;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !enabled) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const n = count;
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const age = new Float32Array(n);
    const life = new Float32Array(n);
    const jitter = new Float32Array(n);
    const reset = (i: number) => {
      px[i] = Math.random() * w;
      py[i] = Math.random() * h;
      age[i] = 0;
      life[i] = 60 + Math.random() * 60;
      jitter[i] = (Math.random() - 0.5) * 0.35;
    };
    for (let i = 0; i < n; i++) {
      reset(i);
      age[i] = Math.random() * life[i];
    }

    let raf = 0;
    let last = performance.now();
    let slowFrames = 0;
    let frames = 0;
    let visible = !document.hidden;
    const onVis = () => {
      visible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const dt = now - last;
      last = now;
      frames++;
      if (dt > 50) slowFrames++;
      if (frames % 90 === 0) {
        if (slowFrames > 60) lowFpsRef.current?.();
        slowFrames = 0;
      }
      const { windMs: V, windFromDeg: from } = windRef.current;
      const bearing = map ? map.getBearing() : 0;
      const toRad = (((from + 180 - bearing) % 360) * Math.PI) / 180;
      const speed = 0.35 + V * 0.28;

      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = 'rgba(0,0,0,0.92)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(${color},0.9)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = toRad + jitter[i];
        const dx = Math.sin(a) * speed;
        const dy = -Math.cos(a) * speed;
        const x0 = px[i];
        const y0 = py[i];
        px[i] += dx;
        py[i] += dy;
        age[i]++;
        if (age[i] > life[i] || px[i] < 0 || py[i] < 0 || px[i] > w || py[i] > h) {
          reset(i);
          continue;
        }
        ctx.moveTo(x0, y0);
        ctx.lineTo(px[i], py[i]);
      }
      ctx.stroke();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      ctx.clearRect(0, 0, w, h);
    };
  }, [enabled, map, count, color]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: enabled ? 0.85 : 0, zIndex: 10, transition: 'opacity .3s' }}
    />
  );
}
