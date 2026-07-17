/**
 * Sample generated identities for the signed-out showcase. In the real app
 * these are minted by the API (LLM name/voice/palette seed + a background hero
 * image); the preview injects a stand-in so the showcase can demo a fully
 * generated, non-flagship kitchen without a network or a session.
 *
 * heroUrl is null here — the preview shows the *procedural* backdrop (the
 * instant "now" state). The generated photograph only exists once the real
 * pipeline has run against a household's shelf.
 */

import type { GeneratedIdentity } from './identity';

/** A generated Thai kitchen — warm light paper, a jade accent, its own voice. */
const THAI: GeneratedIdentity = {
  cuisine: 'thai',
  name: 'บ้านริมน้ำ',
  sub: 'Baan Rim Nam · the riverside house',
  tagline: 'night-market heat, riverside calm',
  mono: false,
  palette: { mode: 'light', hue: 32, accentHue: 162 },
  voice: {
    back: '← กลับ · back',
    launch: 'ลุย — build the cart →',
    add: 'ใส่ — into the basket',
    remove: 'เอาออก — remove',
  },
  heroUrl: null,
  heroStatus: 'pending',
};

export const PREVIEW_IDENTITIES: Record<string, GeneratedIdentity> = {
  thai: THAI,
};
