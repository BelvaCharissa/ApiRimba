import { briefingPrompt, briefingSystem, fallbackBriefing } from '@/lib/briefing';
import { fetchWithTimeout } from '@/lib/data/fallback';
import { rateLimit } from '@/lib/ratelimit';
import { apiError, BriefingRequest, type BriefingResponse } from '@/lib/schemas';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * AI Briefing: Gemini merangkum hasil simulasi menjadi briefing situasi dan prioritas tindakan.
 * Kunci hanya di server (GEMINI_API_KEY). Gagal atau tanpa kunci -> briefing cadangan berbasis aturan.
 */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'briefing');
  if (limited) return limited;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('bad_request', 'Body bukan JSON yang valid.', 400);
  }
  const parsed = BriefingRequest.safeParse(body);
  if (!parsed.success) return apiError('bad_request', 'Data briefing tidak valid.', 400);
  const input = parsed.data;
  const key = process.env.GEMINI_API_KEY;
  // Rantai model: model pilihan di env, lalu model ringan yang cepat. Tiap panggilan dibatasi 12 detik.
  const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-flash-lite-latest', 'gemini-flash-lite-latest', 'gemini-flash-latest'])];

  if (key) {
    for (const model of models) {
      try {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: briefingSystem(input.lang) }] },
              contents: [{ role: 'user', parts: [{ text: briefingPrompt(input) }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
            }),
          },
          12000,
        );
        if (!res.ok) continue;
        const json = (await res.json()) as GeminiResponse;
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
        if (text && /SITUASI|SITUATION/.test(text.toUpperCase())) {
          const out: BriefingResponse = { source: 'gemini', model, text, generatedAt: new Date().toISOString() };
          return Response.json(out);
        }
      } catch {
        // coba model berikutnya
      }
    }
  }
  const out: BriefingResponse = {
    source: 'fallback',
    model: null,
    text: fallbackBriefing(input),
    generatedAt: new Date().toISOString(),
  };
  return Response.json(out);
}
