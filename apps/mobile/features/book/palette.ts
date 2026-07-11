/**
 * Soviet-mode palette — «Пятидневка» / The Book.
 *
 * Cobalt-dominant per the agreed rebalance: deep cobalt is the canvas
 * (a blueprint), ochre is the working surface (spec cards), red is the
 * Bureau's voice (one action per view, stamps, day markers), cream is
 * demoted to type-on-canvas, ink to keylines. Separation rule: red and
 * cobalt (or red and ochre) never touch without a cream/ink boundary.
 *
 * Scoped to the Book feature only — the core app keeps the brand-blue
 * palette in lib/theme.ts. The doorway between them is the costume change.
 */

import { useColorScheme } from 'react-native';

export interface SovietPalette {
  /** Ochre poster field — the page itself. Text on it is ink, never cream. */
  canvas: string;
  /** Ink-tinted hairline on the ochre field. */
  canvasLine: string;
  /** Powder periwinkle — the poster's industrial silhouettes. Shapes only. */
  display: string;
  /** Ink band surface (the plan tray). Cream text on it. */
  tray: string;
  /** Cream paper card surface — the readable content layer. */
  card: string;
  /** Ink keyline around cards (the 2px print border). */
  cardLine: string;
  /** Body text on cream. */
  ink: string;
  /** Secondary text on cream — warm brown, never gray. */
  inkSoft: string;
  /** Type on the canvas. */
  cream: string;
  /** Secondary type on the canvas. */
  creamMuted: string;
  /** The Bureau's red. */
  red: string;
  /** Type on red. */
  onRed: string;
  /** Ochre — demoted to accent duty: quota fill, small badges. */
  accent: string;
  /** Banana gold — the thread back to the master brand. */
  gold: string;
  /** Quota-meter track on the canvas. */
  track: string;
}

/** Day shift — the poster in daylight. */
const dayShift: SovietPalette = {
  canvas: '#D9A441',
  canvasLine: 'rgba(33, 28, 23, 0.28)',
  display: '#647EC7',
  tray: '#211C17',
  card: '#F2E8D5',
  cardLine: '#211C17',
  ink: '#211C17',
  inkSoft: '#6E5D44',
  cream: '#F2E8D5',
  creamMuted: '#F3DFC8',
  red: '#C8332B',
  onRed: '#F2E8D5',
  accent: '#D9A441',
  gold: '#E9C63F',
  track: 'rgba(242, 232, 213, 0.18)',
};

/** Night shift — the poster under a desk lamp: field to umber, inks deepen. */
const nightShift: SovietPalette = {
  canvas: '#6E5619',
  canvasLine: 'rgba(23, 19, 16, 0.4)',
  display: '#4A5C96',
  tray: '#171310',
  card: '#E8DCC3',
  cardLine: '#171310',
  ink: '#211C17',
  inkSoft: '#6E5D44',
  cream: '#EFE4CC',
  creamMuted: '#E3D0B4',
  red: '#B23A31',
  onRed: '#F2E8D5',
  accent: '#C89838',
  gold: '#D9B63A',
  track: 'rgba(239, 228, 204, 0.15)',
};

export function useSovietPalette(): SovietPalette {
  return useColorScheme() === 'dark' ? nightShift : dayShift;
}
