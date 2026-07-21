/**
 * The legibility gate — the structural answer to the cream-on-cream bug.
 *
 * Design review §4/§5: generated-design bugs do not look like "wrong colors".
 * They look like a *surface and its text getting out of sync*. The shipped
 * example: a costume flipped its on-hero ink to near-white for a photo scrim,
 * that override leaked into the shared token set, and a light-mode kitchen drew
 * near-white text on its own L96 canvas. Nothing was individually wrong; the
 * pairing was.
 *
 * So the check is not "is this hue tasteful" — it is "does every pair a screen
 * can actually render clear AA". A seed that fails never reaches a screen: the
 * mint falls back to the house palette and logs the offending pair.
 *
 * NOTE ON DUPLICATION: the ramp constants below mirror
 * `apps/mobile/features/eats/palette.ts` deliberately. There is no shared
 * package (the npm workspace covers apps/api only), and the alternative —
 * shipping a seed the server believes is legible and the client renders
 * differently — is worse than two copies of nine numbers. If you change a ramp
 * there, change it here; the tests below pin the pairs, so a drift shows up as
 * a failure rather than a cream-on-cream card in production.
 */

export interface PaletteSeed {
  mode: 'light' | 'dark';
  hue: number;
  accentHue: number;
}

export interface DerivedTokens {
  canvas: string;
  paper: string;
  card: string;
  ink: string;
  inkSoft: string;
  accent: string;
  onAccent: string;
  onHero: string;
  onHeroSoft: string;
}

function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lig - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export function hslHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslRgb(h, s, l);
  const to = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** WCAG 2.1 relative luminance. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const chan = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

/** WCAG 2.1 contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mirrors the client palette engine's fixed lightness ramps. */
export function deriveTokens(seed: PaletteSeed): DerivedTokens {
  const { hue: h, accentHue: a, mode } = seed;
  if (mode === 'dark') {
    return {
      canvas: hslHex(h, 32, 8),
      paper: hslHex(h, 28, 11),
      card: hslHex(h, 24, 15),
      ink: hslHex(h, 24, 92),
      inkSoft: hslHex(h, 14, 66),
      accent: hslHex(a, 76, 58),
      onAccent: hslHex(a, 45, 10),
      onHero: hslHex(h, 24, 93),
      onHeroSoft: hslHex(h, 14, 72),
    };
  }
  return {
    canvas: hslHex(h, 34, 96),
    paper: hslHex(h, 26, 93),
    card: hslHex(h, 30, 99),
    ink: hslHex(h, 42, 14),
    inkSoft: hslHex(h, 18, 40),
    accent: hslHex(a, 66, 44),
    onAccent: hslHex(a, 45, 98),
    onHero: hslHex(h, 42, 14),
    onHeroSoft: hslHex(h, 18, 40),
  };
}

/** AA body text. Large/display text is allowed the 3:1 threshold. */
const AA_BODY = 4.5;
const AA_LARGE = 3;

interface Pair {
  /** Human name, used in the rejection log so a failure is actionable. */
  name: string;
  fg: keyof DerivedTokens;
  bg: keyof DerivedTokens;
  /** Display-size text only — headlines, the hero title. */
  large?: boolean;
}

/**
 * Every text/surface pair a kitchen screen can actually render.
 *
 * `onHero` is checked against `canvas`, NOT against a photo: a hero image may
 * not have loaded, may have failed, or may never have been generated, and the
 * procedural backdrop is what shows underneath. That is precisely the case the
 * shipped bug fell into.
 */
const PAIRS: Pair[] = [
  { name: 'ink on canvas', fg: 'ink', bg: 'canvas' },
  { name: 'ink on paper', fg: 'ink', bg: 'paper' },
  { name: 'ink on card', fg: 'ink', bg: 'card' },
  { name: 'inkSoft on canvas', fg: 'inkSoft', bg: 'canvas' },
  { name: 'inkSoft on paper', fg: 'inkSoft', bg: 'paper' },
  { name: 'inkSoft on card', fg: 'inkSoft', bg: 'card' },
  { name: 'onAccent on accent', fg: 'onAccent', bg: 'accent' },
  { name: 'onHero on canvas (no photo)', fg: 'onHero', bg: 'canvas', large: true },
  { name: 'onHeroSoft on canvas (no photo)', fg: 'onHeroSoft', bg: 'canvas' },
];

export interface LegibilityFailure {
  pair: string;
  ratio: number;
  required: number;
  fg: string;
  bg: string;
}

export type LegibilityResult =
  | { ok: true; tokens: DerivedTokens }
  | { ok: false; failures: LegibilityFailure[] };

/**
 * Gate a palette seed. Pure — no I/O, no clock, no randomness.
 *
 * On failure the caller falls back to the house palette for that kitchen and
 * logs `failures`; the seed is never persisted.
 */
export function assertLegible(seed: PaletteSeed): LegibilityResult {
  const tokens = deriveTokens(seed);
  const failures: LegibilityFailure[] = [];

  for (const pair of PAIRS) {
    const fg = tokens[pair.fg];
    const bg = tokens[pair.bg];
    const required = pair.large ? AA_LARGE : AA_BODY;
    const ratio = contrast(fg, bg);
    if (ratio < required) {
      failures.push({
        pair: pair.name,
        ratio: Math.round(ratio * 100) / 100,
        required,
        fg,
        bg,
      });
    }
  }

  return failures.length === 0 ? { ok: true, tokens } : { ok: false, failures };
}

/**
 * The fallback when a generated seed is rejected. Verified against the gate by
 * test, NOT by eye — the obvious choice (blue base, warm accent) fails, because
 * a warm accent lands squarely in the light-onAccent hole documented above.
 */
export const HOUSE_SEED: PaletteSeed = { mode: 'light', hue: 0, accentHue: 220 };
