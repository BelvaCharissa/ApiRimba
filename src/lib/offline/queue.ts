/**
 * Antrean laporan warga saat offline (IndexedDB di perangkat).
 * Laporan disimpan lengkap dengan fotonya, lalu dikirim otomatis begitu perangkat online lagi.
 * Di lahan gambut sinyal sering hilang; laporan tidak boleh hilang hanya karena itu.
 */

export type QueuedStatus = 'pending' | 'sending' | 'sent' | 'rejected';

export interface QueuedReport {
  id: string;
  createdAt: string;
  /** Field form selain foto. */
  fields: Record<string, string>;
  photo: Blob | null;
  status: QueuedStatus;
  /** Alasan ditolak (bahasa aktif saat ditolak) atau id laporan bila terkirim. */
  message?: string;
  reportId?: string;
  attempts: number;
}

const DB = 'apirimba-offline';
const STORE = 'reports';
export const QUEUE_EVENT = 'apirimba:queue';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function queueSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function listQueued(): Promise<QueuedReport[]> {
  if (!queueSupported()) return [];
  try {
    const all = await tx<QueuedReport[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedReport[]>);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function enqueueReport(fd: FormData): Promise<QueuedReport> {
  const fields: Record<string, string> = {};
  let photo: Blob | null = null;
  fd.forEach((v, k) => {
    if (typeof v === 'string') fields[k] = v;
    else if (k === 'photo') photo = v;
  });
  const item: QueuedReport = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    fields,
    photo,
    status: 'pending',
    attempts: 0,
  };
  await tx('readwrite', (s) => s.put(item));
  notify();
  return item;
}

async function put(item: QueuedReport) {
  await tx('readwrite', (s) => s.put(item));
}

export async function removeQueued(id: string) {
  await tx('readwrite', (s) => s.delete(id));
  notify();
}

/** Pesan penolakan dari server, dalam dua bahasa (bahasa dipilih saat ditampilkan). */
export const REJECT_MESSAGES: Record<string, [string, string]> = {
  duplicate_report: ['This photo was already reported near the same place in the last 24 hours.', 'Foto ini sudah dilaporkan di sekitar lokasi yang sama dalam 24 jam terakhir.'],
  not_fire: ['The AI check did not find fire, smoke or burnt land in the photo.', 'Pemeriksaan AI tidak menemukan api, asap, atau lahan terbakar di foto.'],
  outside_indonesia: ['The location must be on land in Indonesia.', 'Lokasi harus di daratan Indonesia.'],
  bad_request: ['The report data is not valid.', 'Data laporan tidak valid.'],
  auth_required: ['Sign in again to send this report.', 'Masuk lagi untuk mengirim laporan ini.'],
};

let flushing: Promise<{ sent: number; rejected: number }> | null = null;

/**
 * Kirim semua laporan yang menunggu. Berhenti saat jaringan gagal (masih offline); error server
 * sementara (5xx/429) dicoba lagi nanti; penolakan (duplikat, bukan api, di luar Indonesia) ditandai.
 */
export function flushQueue(): Promise<{ sent: number; rejected: number }> {
  flushing ??= (async () => {
    let sent = 0;
    let rejected = 0;
    if (!queueSupported() || (typeof navigator !== 'undefined' && !navigator.onLine)) return { sent, rejected };
    const items = (await listQueued()).filter((q) => q.status === 'pending' || q.status === 'sending').reverse();
    for (const item of items) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(item.fields)) fd.set(k, v);
      if (item.photo) fd.set('photo', new File([item.photo], 'laporan.jpg', { type: 'image/jpeg' }));
      item.status = 'sending';
      item.attempts += 1;
      await put(item);
      notify();
      let res: Response;
      try {
        res = await fetch('/api/lapor', { method: 'POST', body: fd });
      } catch {
        item.status = 'pending';
        await put(item);
        notify();
        break; // jaringan belum ada; coba lagi saat online
      }
      let code = '';
      let reportId: string | undefined;
      try {
        const json = (await res.json()) as { id?: string; error?: { code?: string } };
        code = json.error?.code ?? '';
        reportId = json.id;
      } catch {
        // respons bukan JSON
      }
      if (res.ok) {
        item.status = 'sent';
        item.message = undefined;
        item.reportId = reportId;
        item.photo = null; // foto tidak perlu disimpan lagi
        sent++;
      } else if (res.status >= 500 || res.status === 429) {
        item.status = 'pending';
      } else if (res.status === 401) {
        // Sesi habis: tetap menunggu sampai pengguna masuk lagi.
        item.status = 'pending';
        item.message = 'auth_required';
      } else {
        item.status = 'rejected';
        item.message = code in REJECT_MESSAGES ? code : 'bad_request';
        rejected++;
      }
      await put(item);
      notify();
      if (item.status === 'pending') break;
    }
    return { sent, rejected };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Fetch gagal karena jaringan (bukan respons error dari server). */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
}
