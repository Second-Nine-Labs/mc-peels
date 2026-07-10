/**
 * Poster-art slots for the Book. Metro requires are static, so the slots stay
 * commented out until the files exist — drop the PNGs into assets/soviet/
 * (names below, see assets/soviet/README.md), then uncomment. Every consumer
 * null-checks, so missing art degrades to the View-drawn placeholders.
 */

import type { ImageSourcePropType } from 'react-native';

export interface BookPosters {
  /** Welder-banana propaganda poster — empty state / hero. */
  worker: ImageSourcePropType | null;
  /** 1961 rocket-banana — launch celebration + Cosmonautics Day (Apr 12). */
  cosmonaut: ImageSourcePropType | null;
  /** Gear-and-bananas emblem — tab glyph / solver spinner. */
  gear: ImageSourcePropType | null;
  /** Crane-lifting-bananas — loading states. */
  crane: ImageSourcePropType | null;
  /** Fist with crossed tools — the Bureau crest (stamps, headers). */
  crest: ImageSourcePropType | null;
  /** Faceted star with orbiting bananas — achievements only. */
  star: ImageSourcePropType | null;
}

export const POSTERS: BookPosters = {
  worker: null,
  cosmonaut: null,
  gear: null,
  crane: null,
  crest: null,
  star: null,
  // Drop files in assets/soviet/ then replace the nulls above with:
  // worker: require('../../assets/soviet/poster-worker.png'),
  // cosmonaut: require('../../assets/soviet/poster-cosmonaut.png'),
  // gear: require('../../assets/soviet/emblem-gear.png'),
  // crane: require('../../assets/soviet/loader-crane.png'),
  // crest: require('../../assets/soviet/crest-bureau.png'),
  // star: require('../../assets/soviet/medal-star.png'),
};
