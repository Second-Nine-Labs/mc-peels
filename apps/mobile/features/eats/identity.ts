/**
 * A generated kitchen identity, client-side. The API mints the language + a
 * palette *seed* (see apps/api/src/ai/kitchen-identity.ts); the palette engine
 * (./palette) turns that seed into premium, contrast-checked costume tokens,
 * and generatedCostume dresses the kitchen with it. Locked per (household,
 * cuisine) so a kitchen's name doesn't drift as more of that cuisine is saved.
 */

import type { KitchenIdentityWire } from '@/lib/types';

export interface PaletteSeed {
  mode: 'light' | 'dark';
  /** Base hue 0-359 for the paper/ink ramp. */
  hue: number;
  /** Accent hue 0-359 for the kitchen's loud color. */
  accentHue: number;
}

export interface IdentityVoice {
  back: string;
  launch: string;
  add: string;
  remove: string;
}

export interface GeneratedIdentity {
  cuisine: string;
  name: string;
  sub: string;
  tagline: string;
  mono: boolean;
  palette: PaletteSeed;
  voice: IdentityVoice | null;
  /** Generated hero image (public CDN URL) — null until the pipeline lands one. */
  heroUrl: string | null;
  /** none | pending | ok | failed. */
  heroStatus: string;
}

export function identityFromWire(wire: KitchenIdentityWire): GeneratedIdentity {
  return {
    cuisine: wire.cuisine,
    name: wire.name,
    sub: wire.sub,
    tagline: wire.tagline,
    mono: wire.mono,
    palette: wire.palette,
    voice: wire.voice,
    heroUrl: wire.hero_url,
    heroStatus: wire.hero_status,
  };
}

/** Wire list → `{ cuisine: identity }`, the shape genesis + costumes consume. */
export function identityMap(wires: KitchenIdentityWire[]): Record<string, GeneratedIdentity> {
  const out: Record<string, GeneratedIdentity> = {};
  for (const wire of wires) out[wire.cuisine] = identityFromWire(wire);
  return out;
}
