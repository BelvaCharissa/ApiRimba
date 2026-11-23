'use client';

import type { Map as MlMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { type WindGrid, windAt } from '@/lib/pantau';

/**
 * Partikel angin nasional di atas peta: arah & kecepatan dari grid angin (interpolasi bilinear).
 * Peta tidak bisa diputar, jadi utara selalu ke atas. Dimatikan bila pengguna memilih gerak dikurangi.
 */
export default function WindField({ map, grid, enabled, light }: { map: MlMap | null; grid: WindGrid | null; enabled: boolean; light: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !map || !enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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

    const n = w < 700 ? 900 : 1800;
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const age = new Float32Array(n);
    const life = new Float32Array(n);
    const reset = (i: number) => {
      px[i] = Math.random() * w;
      py[i] = Math.random() * h;
      age[i] = 0;
      life[i] = 40 + Math.random() * 60;
    };
    for (let i = 0; i < n; i++) {
      reset(i);
      age[i] = Math.random() * life[i];
    }
    const clear = () => ctx.clearRect(0, 0, w, h);
    map.on('move', clear);

    const color = light ? '255,255,255' : '124,199,238';
    let raf = 0;
    let visible = !document.hidden;
    const onVis = () => (visible = !document.hidden);
    document.addEventListener('visibilitychange', onVis);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = `rgba(${color},0.7)`;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const ll = map.unproject([px[i], py[i]]);
        const v = grid ? windAt(grid, ll.lng, ll.lat) : { u: 0.22, v: -0.09 };
        age[i]++;
        if (!v || age[i] > life[i]) {
          reset(i);
          continue;
        }
        const x0 = px[i];
        const y0 = py[i];
        px[i] += v.u * 0.35;
        py[i] -= v.v * 0.35;
        if (px[i] < 0 || py[i] < 0 || px[i] > w || py[i] > h) {
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
      map.off('move', clear);
      document.removeEventListener('visibilitychange', onVis);
      ctx.clearRect(0, 0, w, h);
    };
  }, [map, grid, enabled, light]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full transition-opacity duration-300"
      style={{ opacity: enabled ? 0.85 : 0 }}
    />
  );
}
