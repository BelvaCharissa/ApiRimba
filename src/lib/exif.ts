/**
 * Pembaca EXIF JPEG minimal: koordinat GPS dan waktu ambil foto (DateTimeOriginal).
 * Murni TypeScript, tanpa dependensi. Mengembalikan null bila tidak ada.
 */
export interface ExifInfo {
  lat: number | null;
  lon: number | null;
  takenAt: string | null;
}

export function readExif(buf: Uint8Array): ExifInfo {
  const out: ExifInfo = { lat: null, lon: null, takenAt: null };
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return out;
  let p = 2;
  while (p + 4 < buf.length) {
    if (buf[p] !== 0xff) break;
    const marker = buf[p + 1];
    const len = (buf[p + 2] << 8) | buf[p + 3];
    if (marker === 0xe1 && String.fromCharCode(...buf.slice(p + 4, p + 8)) === 'Exif') {
      try {
        parseTiff(buf, p + 10, out);
      } catch {
        // EXIF rusak: abaikan
      }
      return out;
    }
    if (marker === 0xda) break;
    p += 2 + len;
  }
  return out;
}

function parseTiff(b: Uint8Array, base: number, out: ExifInfo) {
  const le = b[base] === 0x49;
  const u16 = (o: number) => (le ? b[base + o] | (b[base + o + 1] << 8) : (b[base + o] << 8) | b[base + o + 1]);
  const u32 = (o: number) =>
    le
      ? (b[base + o] | (b[base + o + 1] << 8) | (b[base + o + 2] << 16) | (b[base + o + 3] << 24)) >>> 0
      : ((b[base + o] << 24) | (b[base + o + 1] << 16) | (b[base + o + 2] << 8) | b[base + o + 3]) >>> 0;
  const rational = (o: number) => {
    const d = u32(o + 4);
    return d ? u32(o) / d : 0;
  };
  const ascii = (o: number, n: number) => String.fromCharCode(...b.slice(base + o, base + o + n)).replace(/\0+$/, '');

  const entries = (ifd: number) => {
    const n = u16(ifd);
    const list: { tag: number; type: number; count: number; valOff: number }[] = [];
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      list.push({ tag: u16(e), type: u16(e + 2), count: u32(e + 4), valOff: e + 8 });
    }
    return list;
  };
  const ptr = (e: { valOff: number }) => u32(e.valOff);

  const ifd0 = entries(u32(4));
  const exifPtr = ifd0.find((e) => e.tag === 0x8769);
  const gpsPtr = ifd0.find((e) => e.tag === 0x8825);

  if (exifPtr) {
    const dt = entries(ptr(exifPtr)).find((e) => e.tag === 0x9003);
    if (dt) {
      const s = ascii(ptr(dt), dt.count); // "YYYY:MM:DD HH:MM:SS" (waktu lokal kamera)
      const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (m) out.takenAt = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
    }
  }
  if (gpsPtr) {
    const g = entries(ptr(gpsPtr));
    const get = (tag: number) => g.find((e) => e.tag === tag);
    const dms = (e: { valOff: number } | undefined) => {
      if (!e) return null;
      const o = ptr(e);
      return rational(o) + rational(o + 8) / 60 + rational(o + 16) / 3600;
    };
    const latRef = get(0x0001);
    const lonRef = get(0x0003);
    const lat = dms(get(0x0002));
    const lon = dms(get(0x0004));
    if (lat !== null && lon !== null && (lat !== 0 || lon !== 0)) {
      const latS = latRef ? String.fromCharCode(b[latRef.valOff + base]) : 'N';
      const lonW = lonRef ? String.fromCharCode(b[lonRef.valOff + base]) : 'E';
      out.lat = latS === 'S' ? -lat : lat;
      out.lon = lonW === 'W' ? -lon : lon;
    }
  }
}
