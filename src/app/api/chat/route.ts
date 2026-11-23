import { z } from 'zod';
import { HOTLINES } from '@/lib/bantuan';
import { fetchWithTimeout } from '@/lib/data/fallback';
import { getNationalHotspots } from '@/lib/data/national';
import { clusterIncidents, incidentPriority } from '@/lib/pantau';
import { rateLimit } from '@/lib/ratelimit';
import { apiError } from '@/lib/schemas';
import { getViewer } from '@/lib/supabase/server';

export const maxDuration = 30;

const Body = z.object({
  lang: z.enum(['en', 'id']).default('en'),
  page: z.string().max(80).optional(),
  messages: z
    .array(z.object({ role: z.enum(['user', 'model']), text: z.string().min(1).max(2000) }))
    .min(1)
    .max(20),
});

interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const SYSTEM = `You are the ApiRimba assistant, built into a web app that forecasts peat and forest fire spread in Indonesia.
Who uses it: Manggala Agni and BPBD fire crews, verifiers at command posts, village officials, volunteers, donors, and residents near fires.

What the app does (only describe these, never invent features):
- Map & simulation (/peta): live NASA FIRMS satellite hotspots for all of Indonesia (last 72 h), grouped into incidents with a 0-100 priority score. Tapping a hotspot shows wind, air quality, the nearest water sources (rivers, canals, ponds) and services (fire station, police, hospital) and emergency numbers. "Simulate" runs a 12-hour spread forecast: arrival time per village (Safe / Watch / Alert / Danger), three recommended firebreak lines with coordinates, the potential CO2 released and how much a firebreak avoids, a response plan, and a printable briefing.
- Report a fire (/lapor): signed-in residents send a photo (required), location and description. The photo is stamped with date and place, checked by AI for flames or smoke, and compared with satellite hotspots and the photo's GPS within 5 km. A verifier then confirms or rejects it at the verification desk (/petugas).
- Give help (/bantu): people pledge aid (masks, drinking water, food, medical kits, firefighting equipment, shelter) to a province post and get a tracking code (AR-xxxxxx) to follow it until it is distributed. No money moves in the app.
- How it works (/cara-kerja): the model, data sources and limits. The model is not calibrated against past fires; arrival times are rough estimates.
- Accounts: sign in at /masuk. Roles: citizen, verifier and admin. Demo accounts exist for judges.

Emergency numbers in Indonesia: 112 (integrated emergency), 113 (fire brigade), 119 (ambulance), 110 (police), 115 (Basarnas search and rescue). Local BPBD and Manggala Agni can be reached through 112.

How to answer:
- Answer in the user's language (English or Bahasa Indonesia), whichever they write in; default to LANG.
- Keep it short: at most about 90 words.
- Shape: one direct sentence that answers the question first. Then, only if useful, 2 to 4 bullet points, each on its own line starting with "- ". For steps, use "1. ", "2. ", "3. ".
- Put the key number, place or button name in **bold** (for example **Papua, 479 titik** or **Simulasikan**). Mention the page path such as /peta or /lapor where the user can do it.
- No headings, no tables, no emoji, no closing pleasantries, and do not repeat the question.
- Only use numbers from the LIVE DATA block or from the user. If you do not know, say so in one sentence and point to the page that has it.
- Safety first: if someone is near an active fire, tell them to move upwind and away, call 112 or 113, and wear an N95/KN95 mask in smoke. Never tell people to fight a large fire themselves.
- You do not dispatch crews or move money. Say so only if asked.`;

/** Ringkasan titik panas untuk konteks AI. Disimpan 5 menit dan dibatasi 2,5 detik agar tidak memperlambat jawaban. */
let ctxCache: { at: number; text: string } | null = null;
async function buildContext(): Promise<string> {
  const data = await getNationalHotspots();
  const now = Date.now();
  const recent = data.items.filter((h) => now - Date.parse(h.acquiredAt) <= 24 * 3600_000 && !h.persistent);
  const { incidents } = clusterIncidents(recent);
  const prov = new Map<string, number>();
  for (const h of recent) prov.set(h.province, (prov.get(h.province) ?? 0) + 1);
  const topProv = [...prov.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topInc = [...incidents].sort((a, b) => incidentPriority(b, now) - incidentPriority(a, now)).slice(0, 5);
  return [
    `Source: ${data.source === 'nasa-firms' ? 'NASA FIRMS live' : 'sample data (live feed unavailable)'}, fetched ${data.fetchedAt}.`,
    `Hotspots in the last 24 h: ${recent.length}, grouped into ${incidents.length} incidents.`,
    `Provinces with most hotspots: ${topProv.map(([p, n]) => `${p} ${n}`).join(', ') || 'none'}.`,
    `Top-priority incidents: ${
      topInc
        .map((i) => `${i.province} (${i.count} hotspots, max ${Math.round(i.maxFrp)} MW, priority ${incidentPriority(i, now)}, at ${i.lat.toFixed(3)}, ${i.lon.toFixed(3)})`)
        .join('; ') || 'none'
    }.`,
  ].join('\n');
}
async function liveContext(): Promise<string> {
  if (ctxCache && Date.now() - ctxCache.at < 5 * 60_000) return ctxCache.text;
  const text = await Promise.race([
    buildContext().catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 2500)),
  ]);
  if (text) ctxCache = { at: Date.now(), text };
  return text ?? ctxCache?.text ?? 'Live hotspot data unavailable right now.';
}

function fallback(lang: 'en' | 'id', q: string): string {
  const s = q.toLowerCase();
  const id = lang === 'id';
  const nums = HOTLINES.map((h) => `**${h.number}** (${h.label})`).join(', ');
  if (/lapor|report|foto|photo/.test(s))
    return id
      ? 'Buka /lapor lalu kirim laporan berfoto.\n1. Ambil atau unggah **foto** (wajib).\n2. Tandai **lokasi** api di peta.\n3. Tulis apa yang terlihat, lalu **Kirim**.\n- Laporan dicek AI dan titik panas satelit, lalu dikonfirmasi petugas di /petugas.'
      : 'Open /lapor and send a photo report.\n1. Take or upload a **photo** (required).\n2. Mark the fire **location** on the map.\n3. Describe what you see, then **Send**.\n- Reports are checked by AI and satellite hotspots, then confirmed by a verifier at /petugas.';
  if (/bantu|donasi|donat|help|aid|pledge/.test(s))
    return id
      ? 'Buka /bantu untuk menjanjikan bantuan ke posko.\n1. Pilih **posko provinsi** dan jenis bantuan.\n2. Isi jumlahnya, lalu simpan **kode lacak** AR-xxxxxx.\n- Tidak ada pembayaran di aplikasi.'
      : 'Open /bantu to pledge aid to a post.\n1. Pick a **province post** and an aid type.\n2. Enter the quantity and keep the **tracking code** AR-xxxxxx.\n- No payment happens in the app.';
  return id
    ? `Asisten AI sedang tidak tersedia. Bila ada api di dekat Anda, menjauh ke arah melawan angin dan hubungi ${nums}.`
    : `The AI assistant is unavailable right now. If there is a fire near you, move upwind and away, and call ${nums}.`;
}

const TEXT_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

/** Baca stream SSE Gemini dan teruskan potongan teksnya sebagai teks biasa. */
function relay(body: ReadableStream<Uint8Array>, deadlineMs: number): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = '';
  const stopAt = Date.now() + deadlineMs;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          if (Date.now() > stopAt) {
            await reader.cancel();
            controller.close();
            return;
          }
          const { value, done } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          buf += dec.decode(value, { stream: true });
          let out = '';
          let nl: number;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            try {
              const chunk = JSON.parse(line.slice(5).trim()) as GeminiChunk;
              out += chunk.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
            } catch {
              // potongan tidak lengkap; abaikan
            }
          }
          if (out) {
            controller.enqueue(enc.encode(out));
            return;
          }
        }
      } catch {
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}

/**
 * Asisten AI. Jawaban dialirkan (streaming) sebagai teks biasa agar kata pertama muncul cepat.
 * Format jawaban: markdown ringan (paragraf, "- " poin, "1. " langkah, **tebal**) yang dirender widget.
 */
export async function POST(req: Request) {
  const { user } = await getViewer();
  if (!user) return apiError('auth_required', 'Please sign in to use Ask AI.', 401);
  const limited = await rateLimit(req, 'chat');
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('bad_request', 'Invalid JSON body.', 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError('bad_request', 'Invalid chat request.', 400);
  const { lang, messages, page } = parsed.data;
  const last = messages[messages.length - 1].text;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return new Response(fallback(lang, last), { headers: { ...TEXT_HEADERS, 'X-Chat-Source': 'fallback' } });

  const ctx = await liveContext();
  const system = `${SYSTEM.replace('LANG', lang === 'id' ? 'Bahasa Indonesia' : 'English')}\n\nLIVE DATA\n${ctx}\nUser is on page: ${page ?? '/'}`;
  const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-flash-lite-latest', 'gemini-flash-lite-latest', 'gemini-flash-latest'])];
  for (const model of models) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
            generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
          }),
        },
        8000,
      );
      if (!res.ok || !res.body) continue;
      return new Response(relay(res.body, 25_000), { headers: { ...TEXT_HEADERS, 'X-Chat-Source': 'gemini' } });
    } catch {
      // model berikutnya
    }
  }
  return new Response(fallback(lang, last), { headers: { ...TEXT_HEADERS, 'X-Chat-Source': 'fallback' } });
}
