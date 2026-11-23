'use client';

import { useEffect, useState } from 'react';

/** Waktu sekarang (ms) yang diperbarui berkala, agar render tetap murni. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
