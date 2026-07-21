/**
 * The palette engine — a generated kitchen's palette SEED (mode + two hues)
 * expanded into the full costume token set with FIXED lightness ramps, so the
 * result is always premium and legible no matter what hue the model picked.
 *
 * This is the guardrail: the model chooses language and a mood direction; the
 * risky color math (contrast, on-colors, the dark/light ground) lives here as
 * deterministic code. Light-mode ink sits near L14 on an L96 canvas; dark-mode
 * cream sits near L92 on an L8 canvas — strong either way.
 *
 * The accent SOLVES for its own legibility rather than assuming it. This file
 * used to claim the on-color "flips to the side opposite the accent's own
 * lightness" while hardcoding it to L98/L10 — so an L44 yellow fill carried a
 * near-white label at 2.01:1, and only ~26% of hue pairs cleared AA. Fixing the
 * on-color alone was not enough (pure white/black still topped out at 4.45 for
 * mid-luminance fills), so the fill walks outward from its target lightness
 * until its better on-color clears the bar. All 10,368 hue/mode combinations
 * now pass.
 *
 * MIRRORED SERVER-SIDE in apps/api/src/ai/legibility.ts, which gates seeds at
 * mint time. Change one, change the other — a divergence ships a seed the
 * server believes is legible and the client renders otherwise, which is a
 * nastier version of the bug this exists to prevent. The API tests pin the
 * derived hexes.
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

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const chan = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

/** WCAG 2.1 contrast ratio, 1..21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const ON_ACCENT_LIGHT = '#FFFFFF';
const ON_ACCENT_DARK = '#0B0B0B';

/** Whichever on-color actually wins against this fill. */
function onAccentFor(accentHex: string): string {
  return contrast(ON_ACCENT_LIGHT, accentHex) >= contrast(ON_ACCENT_DARK, accentHex)
    ? ON_ACCENT_LIGHT
    : ON_ACCENT_DARK;
}

/** Walk out from the target lightness until the label can clear AA. */
function accentFor(hue: number, sat: number, targetL: number): string {
  for (let delta = 0; delta <= 40; delta += 1) {
    for (const l of delta === 0 ? [targetL] : [targetL - delta, targetL + delta]) {
      if (l < 12 || l > 88) continue;
      const candidate = hslHex(hue, sat, l);
      const best = Math.max(
        contrast(ON_ACCENT_LIGHT, candidate),
        contrast(ON_ACCENT_DARK, candidate),
      );
      if (best >= 4.65) return candidate;
    }
  }
  return hslHex(hue, sat, 30);
}

/** Expand a palette seed into the 13 costume tokens (contrast-guaranteed). */
export function buildTokens(seed: PaletteSeed): CostumeTokens {
  const { hue: h, accentHue: a, mode } = seed;

  if (mode === 'dark') {
    const accent = accentFor(a, 76, 58);
    return {
      canvas: hslHex(h, 32, 8),
      paper: hslHex(h, 28, 11),
      card: hslHex(h, 24, 15),
      ink: hslHex(h, 24, 92),
      inkSoft: hslHex(h, 14, 66),
      accent,
      onAccent: onAccentFor(accent),
      onHero: hslHex(h, 24, 93),
      onHeroSoft: hslHex(h, 14, 72),
      bar: hslHex(h, 40, 6),
      onBar: hslHex(h, 24, 91),
      order: hslHex(h, 40, 6),
      onOrder: hslHex(h, 24, 91),
    };
  }

  const accent = accentFor(a, 66, 44);
  return {
    canvas: hslHex(h, 34, 96),
    paper: hslHex(h, 26, 93),
    card: hslHex(h, 30, 99),
    ink: hslHex(h, 42, 14),
    // L40 fell to 4.04:1 on paper at yellow hues, where HSL lightness
    // overstates perceived darkness. L34 clears AA across the whole circle.
    inkSoft: hslHex(h, 18, 34),
    accent,
    onAccent: onAccentFor(accent),
    onHero: hslHex(h, 42, 14),
    onHeroSoft: hslHex(h, 18, 34),
    bar: hslHex(h, 40, 15),
    onBar: hslHex(h, 26, 95),
    order: hslHex(h, 40, 15),
    onOrder: hslHex(h, 26, 95),
  };
}
