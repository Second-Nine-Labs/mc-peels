/**
 * The palette engine — a generated kitchen's palette SEED (mode + two hues)
 * expanded into the full costume token set with FIXED lightness ramps, so the
 * result is always premium and legible no matter what hue the model picked.
 *
 * This is the guardrail: the model chooses language and a mood direction; the
 * risky color math (contrast, on-colors, the dark/light ground) lives here as
 * deterministic code. Light-mode ink sits near L14 on an L96 canvas; dark-mode
 * cream sits near L92 on an L8 canvas — strong either way. The accent's text
 * color flips to the side opposite the accent's own lightness.
 */

import type { CostumeTokens } from './costume';
import type { PaletteSeed } from './identity';

function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = ((((h % 360) + 360) % 360)) / 60;
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

/** `#rrggbb` from HSL (h 0-359, s/l 0-100). */
export function hslHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslRgb(h, s, l);
  const to = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** `rgba(...)` from HSL + alpha — for the backdrop's translucent washes. */
export function hslA(h: number, s: number, l: number, a: number): string {
  const [r, g, b] = hslRgb(h, s, l);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

/** Expand a palette seed into the 13 costume tokens (contrast-guaranteed). */
export function buildTokens(seed: PaletteSeed): CostumeTokens {
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
      bar: hslHex(h, 40, 6),
      onBar: hslHex(h, 24, 91),
      order: hslHex(h, 40, 6),
      onOrder: hslHex(h, 24, 91),
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
    bar: hslHex(h, 40, 15),
    onBar: hslHex(h, 26, 95),
    order: hslHex(h, 40, 15),
    onOrder: hslHex(h, 26, 95),
  };
}
