import { BRIEFING_SYSTEM, briefingPrompt, fallbackBriefing } from '@/lib/briefing';
import { fetchWithTimeout } from '@/lib/data/fallback';
import { apiError, BriefingRequest, type BriefingResponse } from '@/lib/schemas';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * AI Briefing: Gemini merangkum hasil simulasi menjadi briefing situasi dan prioritas tindakan.
 * Kunci hanya di server (GEMINI_API_KEY). Gagal atau tanpa kunci -> briefing cadangan berbasis aturan.
 */
export async function POST(req: Request) {
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
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (key) {
    try {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: BRIEFING_SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: briefingPrompt(input) }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        },
        15000,
      );
      if (res.ok) {
        const json = (await res.json()) as GeminiResponse;
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
        if (text && text.includes('SITUASI')) {
          const out: BriefingResponse = { source: 'gemini', model, text, generatedAt: new Date().toISOString() };
          return Response.json(out);
        }
      }
    } catch {
      // jatuh ke briefing cadangan
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
