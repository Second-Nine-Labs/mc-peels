/**
 * Minimal Gemini image-generation client — no SDK dependency, just fetch.
 *
 * Model id is env-overridable (GEMINI_IMAGE_MODEL) rather than hardcoded:
 * Google ships new Nano Banana generations faster than this file gets
 * touched, and a wrong-but-plausible id fails loudly on the first call
 * (see generateImage's fail-fast note) rather than silently.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** $/image at 1K output — gemini-2.5-flash-image, July 2026 pricing. Estimate only. */
export const COST_PER_IMAGE_USD = 0.039;

export class GeminiImageError extends Error {}

/**
 * Generate one image from a text prompt. Returns { bytes: Buffer, mimeType }.
 * Throws GeminiImageError with a diagnosis-shaped message on failure — the
 * caller fails the whole batch fast on the first error rather than burning
 * through 40 calls against a bad key or wrong model id.
 */
export async function generateImage(prompt, { apiKey, model = DEFAULT_MODEL }) {
  const url = `${ENDPOINT_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GeminiImageError(
      `Gemini ${res.status} ${res.statusText} — model "${model}". ` +
        (res.status === 400
          ? 'Likely a bad model id or malformed request.'
          : res.status === 403
            ? 'Likely a bad API key or billing not enabled on this project.'
            : res.status === 404
              ? `Model "${model}" not found — it may have been renamed/retired; set GEMINI_IMAGE_MODEL to override.`
              : '') +
        (body ? `\n${body.slice(0, 500)}` : ''),
    );
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart) {
    const textPart = parts.find((part) => part.text)?.text;
    throw new GeminiImageError(
      `Gemini returned no image for this prompt.` +
        (textPart ? ` Model said: "${textPart.slice(0, 300)}"` : ' (empty response)'),
    );
  }

  return {
    bytes: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType ?? 'image/png',
  };
}
