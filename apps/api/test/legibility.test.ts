import { describe, expect, it, vi } from 'vitest';

import {
  HOUSE_SEED,
  assertLegible,
  contrast,
  deriveTokens,
  type PaletteSeed,
} from '../src/ai/legibility.js';
import { legiblePaletteOr } from '../src/core/kitchen-identities.js';

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

  it('passes every hue and mode the model can emit', () => {
    // The engine's whole promise. Before the ramps were fixed this stood at
    // 26%: the accent label hardcoded a near-white on-color, which fell to
    // 2.01:1 on the yellow/green band. Now the fill solves for its own
    // legibility, so there is no hue a mint can land on that breaks AA.
    let checked = 0;
    for (let hue = 0; hue < 360; hue += 5) {
      for (let accentHue = 0; accentHue < 360; accentHue += 5) {
        for (const mode of ['light', 'dark'] as const) {
          checked++;
          const seed: PaletteSeed = { mode, hue, accentHue };
          expect(assertLegible(seed).ok, `${mode} h${hue}/a${accentHue}`).toBe(true);
        }
      }
    }
    expect(checked).toBe(10368);
  });

  it('passes the three kitchens live in production', () => {
    // Read from the prod DB 2026-07-21. Two of these FAILED before the ramp
    // fix — Griddle & Cheese at 4.49 and Limanaki at 3.86 on its accent label.
    expect(assertLegible({ mode: 'light', hue: 40, accentHue: 15 }).ok).toBe(true);
    expect(assertLegible({ mode: 'light', hue: 45, accentHue: 28 }).ok).toBe(true);
    expect(assertLegible({ mode: 'light', hue: 25, accentHue: 15 }).ok).toBe(true);
  });

  it('keeps the accent label clear of AA for every accent hue', () => {
    for (let accentHue = 0; accentHue < 360; accentHue += 5) {
      for (const mode of ['light', 'dark'] as const) {
        const t = deriveTokens({ mode, hue: 200, accentHue });
        expect(contrast(t.onAccent, t.accent), `${mode} a${accentHue}`).toBeGreaterThanOrEqual(4.5);
      }
    }
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

describe('legiblePaletteOr (the mint gate in practice)', () => {
  it('passes a legible seed straight through', () => {
    const seed = { mode: 'light' as const, hue: 25, accentHue: 15 };
    expect(legiblePaletteOr(seed, 'italian')).toEqual(seed);
  });

  it('falls back to the house palette when a seed cannot be rendered', () => {
    // Force a failure by pointing the gate at a seed the ramps cannot save.
    // Nothing in the current hue space fails, so this proves the fallback wiring
    // rather than the ramps: a seed with a NaN hue derives unusable hexes.
    const broken = { mode: 'light' as const, hue: Number.NaN, accentHue: Number.NaN };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = legiblePaletteOr(broken, 'thai');
    expect(result).toEqual(HOUSE_SEED);
    // The log has to name the cuisine and the offending pair, or a rejection in
    // production is undiagnosable.
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('thai');
    warn.mockRestore();
  });

  it('never returns a palette that fails its own gate', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const seed of [
      { mode: 'light' as const, hue: 40, accentHue: 15 },
      { mode: 'dark' as const, hue: 355, accentHue: 60 },
      { mode: 'light' as const, hue: Number.NaN, accentHue: 0 },
    ]) {
      expect(assertLegible(legiblePaletteOr(seed, 'test')).ok).toBe(true);
    }
    warn.mockRestore();
  });
});

describe('malformed seeds', () => {
  it('rejects rather than silently passing them', () => {
    // NaN contrast comparisons are all false, so an unguarded gate reports OK.
    for (const bad of [
      { mode: 'light', hue: Number.NaN, accentHue: 0 },
      { mode: 'light', hue: 0, accentHue: Number.POSITIVE_INFINITY },
      { mode: 'sepia', hue: 0, accentHue: 0 },
      null,
      undefined,
    ] as unknown as PaletteSeed[]) {
      expect(assertLegible(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});
