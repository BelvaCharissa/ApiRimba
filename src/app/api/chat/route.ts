import { z } from 'zod';
import { HOTLINES } from '@/lib/bantuan';
import { fetchWithTimeout } from '@/lib/data/fallback';
import { getNationalHotspots } from '@/lib/data/national';
import { clusterIncidents, incidentPriority } from '@/lib/pantau';
import { rateLimit } from '@/lib/ratelimit';
import { apiError } from '@/lib/schemas';
import { getViewer } from '@/lib/supabase/server';

const Body = z.object({
  lang: z.enum(['en', 'id']).default('en'),
  page: z.string().max(80).optional(),
  messages: z
    .array(z.object({ role: z.enum(['user', 'model']), text: z.string().min(1).max(2000) }))
    .min(1)
    .max(20),
});

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const SYSTEM = `You are the ApiRimba assistant, built into a web app that forecasts peat and forest fire spread in Indonesia.
Who uses it: Manggala Agni and BPBD fire crews, village officials, volunteers, donors, and residents near fires.

What the app does (only describe these, do not invent features):
- Map & simulation (/peta): live NASA FIRMS satellite hotspots for all of Indonesia (last 72 h), grouped into incidents with a 0-100 priority score (number of hotspots, fire strength in MW, how recent, satellite confidence). Clicking a hotspot shows wind, air quality, the nearest water sources and services (fire station, police, hospital, village office from OpenStreetMap) and emergency numbers. From there a 12-hour spread simulation runs in the browser: arrival time per village (Safe / Watch / Alert / Danger), three recommended firebreak locations with coordinates, a response plan, and a briefing.
- Report a fire (/lapor): residents send a photo (required), location and description. Each report is checked automatically: the photo must exist, its GPS and time (if present) are compared with the reported location, and it is compared against satellite hotspots within 5 km. Matched reports are marked "Matched"; others wait for officer review.
- Give help (/bantu): people pledge aid (masks, drinking water, food, medical kits, firefighting equipment, shelter) to a province post. The page shows how much of each need is already pledged. No payment happens in the app.
- How it works (/cara-kerja): model, data sources and limits. The model is not calibrated against historical fires; times are rough estimates.

Emergency numbers in Indonesia: 112 (integrated emergency), 113 (fire brigade), 119 (ambulance), 110 (police), 115 (Basarnas search and rescue). Local BPBD and Manggala Agni can be reached through 112.

Rules:
- Answer in the user's language (English or Bahasa Indonesia), whichever they write in; default to LANG.
- Be short and concrete: 2-6 sentences or a short list. Plain text, no markdown headings, no emoji.
- Only use numbers from the LIVE DATA block or from the user. If you do not know, say so and point to the page that has it.
- Safety first: if someone is near an active fire, tell them to move upwind and away, call 112 or 113, and wear an N95/KN95 mask in smoke. Never tell people to fight a large fire themselves.
- You do not dispatch crews, verify reports, or move money. Say so if asked.`;

async function liveContext(): Promise<string> {
  try {
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
  } catch {
    return 'Live hotspot data unavailable right now.';
  }
}

function fallback(lang: 'en' | 'id', q: string): string {
  const s = q.toLowerCase();
  const id = lang === 'id';
  const nums = HOTLINES.map((h) => `${h.number} (${h.label})`).join(', ');
  if (/lapor|report|foto|photo/.test(s))
    return id
      ? 'Buka menu Lapor. Unggah foto (wajib), tandai lokasi, dan tulis apa yang terlihat. Laporan dicocokkan otomatis dengan titik panas satelit dalam radius 5 km sebelum ditampilkan sebagai "Cocok".'
      : 'Open Report. Upload a photo (required), mark the location and describe what you see. Each report is checked against satellite hotspots within 5 km before it is shown as "Matched".';
  if (/bantu|donasi|donat|help|aid|pledge/.test(s))
    return id
      ? 'Buka menu Bantu. Pilih posko provinsi, jenis bantuan, dan jumlahnya. Halaman itu menampilkan berapa persen kebutuhan yang sudah dijanjikan. Tidak ada pembayaran di aplikasi.'
      : 'Open Give help. Pick a province post, an aid type and a quantity. The page shows what share of each need is already pledged. No payment happens in the app.';
  return id
    ? `Asisten AI sedang tidak tersedia. Kalau ada api di dekat Anda, menjauh ke arah melawan angin dan hubungi ${nums}.`
    : `The AI assistant is unavailable right now. If there is a fire near you, move upwind and away, and call ${nums}.`;
}

/** Chat asisten: Gemini dengan konteks titik panas terkini. Tanpa kunci atau gagal -> jawaban berbasis aturan. */
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
  if (!key) return Response.json({ source: 'fallback', text: fallback(lang, last) });

  const ctx = await liveContext();
  const system = `${SYSTEM.replace('LANG', lang === 'id' ? 'Bahasa Indonesia' : 'English')}\n\nLIVE DATA\n${ctx}\nUser is on page: ${page ?? '/'}`;
  const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-flash-lite-latest', 'gemini-flash-lite-latest', 'gemini-flash-latest'])];
  for (const model of models) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
            generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
          }),
        },
        15000,
      );
      if (!res.ok) continue;
      const json = (await res.json()) as GeminiResponse;
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
      if (text) return Response.json({ source: 'gemini', text });
    } catch {
      // model berikutnya
    }
  }
  return Response.json({ source: 'fallback', text: fallback(lang, last) });
}
