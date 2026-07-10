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
  /** Deep cobalt field — body text (cream) passes contrast on it. */
  canvas: string;
  /** Faint cream hairline on the canvas (tray borders). */
  canvasLine: string;
  /** Bright display cobalt — backdrop motifs and emblems, never text fields. */
  display: string;
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

/** Day shift. */
const dayShift: SovietPalette = {
  canvas: '#2E509F',
  canvasLine: 'rgba(242, 232, 213, 0.18)',
  display: '#3B66C9',
  card: '#F2E8D5',
  cardLine: '#211C17',
  ink: '#211C17',
  inkSoft: '#6E5D44',
  cream: '#F2E8D5',
  creamMuted: '#C9D6F2',
  red: '#C8332B',
  onRed: '#F2E8D5',
  accent: '#D9A441',
  gold: '#E9C63F',
  track: 'rgba(23, 20, 40, 0.35)',
};

/** Night shift — cobalt deepened toward navy, paper dimmed like lamplight. */
const nightShift: SovietPalette = {
  canvas: '#1B2A54',
  canvasLine: 'rgba(242, 232, 213, 0.14)',
  display: '#33569F',
  card: '#E8DCC3',
  cardLine: '#171310',
  ink: '#211C17',
  inkSoft: '#6E5D44',
  cream: '#EFE4CC',
  creamMuted: '#AFC0E8',
  red: '#D5473F',
  onRed: '#F2E8D5',
  accent: '#C89838',
  gold: '#D9B63A',
  track: 'rgba(0, 0, 0, 0.35)',
};

export function useSovietPalette(): SovietPalette {
  return useColorScheme() === 'dark' ? nightShift : dayShift;
}
