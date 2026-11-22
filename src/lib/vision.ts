/**
 * Pemeriksaan foto laporan oleh AI (Gemini, model multimodal): apakah foto benar-benar
 * memperlihatkan api, asap, atau lahan bekas terbakar. Hanya dipanggil di server.
 * Tanpa GEMINI_API_KEY atau bila layanan gagal: null (laporan menunggu petugas).
 */
import { fetchWithTimeout } from '@/lib/data/fallback';

export type AiLabel = 'fire' | 'smoke' | 'burnt' | 'none' | 'unclear';

export interface PhotoCheck {
  label: AiLabel;
  /** 0..1 */
  confidence: number;
  /** Alasan singkat (bahasa Indonesia). */
  reason: string;
  model: string;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const PROMPT = `You check citizen photos sent to a forest and peat fire reporting app in Indonesia.
Look only at the image. Decide what it shows:
- "fire": visible flames or glowing embers outdoors (vegetation, peat, land, forest).
- "smoke": smoke or thick haze rising from land or vegetation, flames not visible.
- "burnt": blackened or charred ground or vegetation after a fire.
- "none": no sign of fire, smoke or burnt land (e.g. people, food, indoor scenes, screenshots, documents, a normal green field, a candle, a stove, a cigarette).
- "unclear": too dark, blurry, or too far away to tell.
Screenshots of other apps, pictures of a screen, cartoons, and stock-looking images should be "none" with a reason that says so.
Reply as JSON only: {"label": one of the five, "confidence": number from 0 to 1, "reason": one short sentence in Bahasa Indonesia describing what you see}.`;

export async function checkFirePhoto(bytes: Uint8Array, mime: string): Promise<PhotoCheck | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-flash-lite-latest', 'gemini-flash-latest'])];
  const data = Buffer.from(bytes).toString('base64');
  for (const model of models) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data } }, { text: PROMPT }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 300, responseMimeType: 'application/json' },
          }),
        },
        15000,
      );
      if (!res.ok) continue;
      const json = (await res.json()) as GeminiResponse;
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      const parsed = parseCheck(text);
      if (parsed) return { ...parsed, model };
    } catch {
      // coba model berikutnya
    }
  }
  return null;
}

/** Urai jawaban JSON model; toleran terhadap pagar kode atau teks di sekitarnya. */
export function parseCheck(text: string): Omit<PhotoCheck, 'model'> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as { label?: unknown; confidence?: unknown; reason?: unknown };
    const labels: AiLabel[] = ['fire', 'smoke', 'burnt', 'none', 'unclear'];
    const label = labels.find((l) => l === o.label);
    if (!label) return null;
    const c = typeof o.confidence === 'number' && Number.isFinite(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : 0.5;
    const reason = typeof o.reason === 'string' ? o.reason.trim().slice(0, 300) : '';
    return { label, confidence: Math.round(c * 1000) / 1000, reason };
  } catch {
    return null;
  }
}

/** Foto ditolak langsung bila AI yakin tidak ada tanda api sama sekali. */
export function isClearlyNotFire(c: PhotoCheck | null): boolean {
  return !!c && c.label === 'none' && c.confidence >= 0.7;
}
