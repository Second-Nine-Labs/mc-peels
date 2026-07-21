import { describe, expect, it } from 'vitest';

import {
  HOUSE_SEED,
  assertLegible,
  contrast,
  deriveTokens,
  type PaletteSeed,
} from '../src/ai/legibility.js';

describe('contrast', () => {
  it('matches known WCAG anchors', () => {
    // Black on white is the definitional 21:1; identical colors are 1:1.
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // Order must not matter.
    expect(contrast('#208AEF', '#FFFFFF')).toBeCloseTo(contrast('#FFFFFF', '#208AEF'), 10);
  });

  it('reproduces the review\'s measured light-canvas figure', () => {
    // Review §6: white body text on the brand blue is 3.53:1 — below AA.
    expect(contrast('#FFFFFF', '#208AEF')).toBeCloseTo(3.53, 1);
  });
});

describe('assertLegible', () => {
  it('passes the house seed', () => {
    const result = assertLegible(HOUSE_SEED);
    expect(result.ok).toBe(true);
  });

  it('catches the accent-label hole in the current ramps', () => {
    // DOCUMENTS A REAL DEFECT, not a hypothetical. palette.ts says "the
    // accent's text color flips to the side opposite the accent's own
    // lightness" — but light mode hardcodes onAccent to L98 regardless. For
    // any accent hue whose L44 fill is perceptually light (the yellow/green
    // band), that is near-white on near-white.
    const yellowAccent: PaletteSeed = { mode: 'light', hue: 240, accentHue: 60 };
    const result = assertLegible(yellowAccent);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const hit = result.failures.find((f) => f.pair === 'onAccent on accent');
      expect(hit).toBeDefined();
      expect(hit!.ratio).toBeLessThan(2.5);
    }
  });

  it('rejects two of the three kitchens live in production today', () => {
    // Griddle & Cheese and Limanaki, read from the prod DB 2026-07-21. This is
    // the gate earning its keep before a single new seed is minted.
    expect(assertLegible({ mode: 'light', hue: 40, accentHue: 15 }).ok).toBe(false);
    expect(assertLegible({ mode: 'light', hue: 45, accentHue: 28 }).ok).toBe(false);
    // Trattoria Sarda passes — the hole is real but not universal.
    expect(assertLegible({ mode: 'light', hue: 25, accentHue: 15 }).ok).toBe(true);
  });

  it('reports the offending pair, not just a boolean', () => {
    // A deliberately broken derivation: near-white ink on a near-white canvas,
    // which is the shipped cream-on-cream bug expressed as numbers.
    const cream = '#FBF7F2';
    const paper = deriveTokens({ mode: 'light', hue: 32, accentHue: 162 }).canvas;
    const ratio = contrast(cream, paper);
    expect(ratio).toBeLessThan(4.5);
    // The gate's job is to make that number visible before it ships.
    expect(ratio).toBeGreaterThan(1);
  });

  it('is pure — same seed, same answer', () => {
    const seed: PaletteSeed = { mode: 'dark', hue: 355, accentHue: 20 };
    expect(assertLegible(seed)).toEqual(assertLegible(seed));
  });
});

describe('deriveTokens', () => {
  it('pins the ramp for the shipped Thai preview seed', () => {
    // apps/mobile/features/eats/preview-identities.ts. If the client ramp
    // changes and this server copy does not, this fails instead of shipping a
    // seed the server believes is legible and the client renders differently.
    const tokens = deriveTokens({ mode: 'light', hue: 32, accentHue: 162 });
    expect(tokens.canvas).toBe('#f8f5f1');
    expect(tokens.ink).toBe('#332515');
  });

  it('keeps light ink dark and dark ink light', () => {
    const light = deriveTokens({ mode: 'light', hue: 200, accentHue: 40 });
    const dark = deriveTokens({ mode: 'dark', hue: 200, accentHue: 40 });
    expect(contrast(light.ink, '#FFFFFF')).toBeGreaterThan(contrast(light.ink, '#000000'));
    expect(contrast(dark.ink, '#000000')).toBeGreaterThan(contrast(dark.ink, '#FFFFFF'));
  });
});
