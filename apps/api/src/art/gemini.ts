/**
 * Nano Banana (Gemini image generation) — one call, one dish tile.
 * Plain REST via fetch; a whole SDK is not worth one endpoint.
 */

import { env } from '../env.js';

export class ArtGenerationError extends Error {}

/** Both casings appear in the wild (REST is camelCase; be tolerant). */
interface GeminiPart {
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

export interface GeneratedImage {
  bytes: Buffer;
  mimeType: string;
}

/** Pull the first inline image out of a generateContent response body. */
export function parseGeminiImage(body: unknown): GeneratedImage | null {
  const parts = (body as GeminiResponse)?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data && inline.data.length > 0) {
      return {
        bytes: Buffer.from(inline.data, 'base64'),
        mimeType: part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? 'image/png',
      };
    }
  }
  return null;
}

export async function generateDishImage(prompt: string): Promise<GeneratedImage> {
  const key = env().GEMINI_API_KEY;
  if (!key) throw new ArtGenerationError('GEMINI_API_KEY is not configured');

  const model = env().GEMINI_IMAGE_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ArtGenerationError(`Gemini request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const image = parseGeminiImage(await response.json());
  if (!image) throw new ArtGenerationError('Gemini response contained no image');
  return image;
}
