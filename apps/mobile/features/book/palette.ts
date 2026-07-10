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
  /** Deep cobalt blueprint field — body text (cream) passes contrast on it. */
  canvas: string;
  /** Faint cream grid line drawn on the canvas. */
  canvasLine: string;
  /** Bright display cobalt — shapes and emblems on the canvas, never text fields. */
  display: string;
  /** Ochre spec-card surface. */
  card: string;
  /** Ink keyline around cards (the 2px print border). */
  cardLine: string;
  /** Body text on ochre. */
  ink: string;
  /** Secondary text on ochre — dark ochre-brown, never gray. */
  inkSoft: string;
  /** Type on the canvas. */
  cream: string;
  /** Secondary type on the canvas. */
  creamMuted: string;
  /** The Bureau's red. */
  red: string;
  /** Type on red. */
  onRed: string;
  /** Banana gold — the thread back to the master brand; quota fill. */
  gold: string;
  /** Quota-meter track on the canvas. */
  track: string;
}

/** Day shift. */
const dayShift: SovietPalette = {
  canvas: '#2E509F',
  canvasLine: 'rgba(242, 232, 213, 0.10)',
  display: '#3B66C9',
  card: '#D9A441',
  cardLine: '#211C17',
  ink: '#211C17',
  inkSoft: '#6B4E14',
  cream: '#F2E8D5',
  creamMuted: '#C9D6F2',
  red: '#C8332B',
  onRed: '#F2E8D5',
  gold: '#E9C63F',
  track: 'rgba(23, 20, 40, 0.35)',
};

/** Night shift — cobalt deepened toward navy, ochre dimmed toward mustard. */
const nightShift: SovietPalette = {
  canvas: '#1B2A54',
  canvasLine: 'rgba(242, 232, 213, 0.08)',
  display: '#33569F',
  card: '#BE8B31',
  cardLine: '#171310',
  ink: '#171310',
  inkSoft: '#59430E',
  cream: '#EFE4CC',
  creamMuted: '#AFC0E8',
  red: '#D5473F',
  onRed: '#F2E8D5',
  gold: '#D9B63A',
  track: 'rgba(0, 0, 0, 0.35)',
};

export function useSovietPalette(): SovietPalette {
  return useColorScheme() === 'dark' ? nightShift : dayShift;
}
