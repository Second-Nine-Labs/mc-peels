/**
 * Poster-art slots for the Book. Delivered art lives in assets/soviet/ as
 * compact JPEGs (flat print art compresses well; emblems sit on their cream
 * plates by design). Still-empty slots stay null and consumers null-check,
 * so missing art degrades to the View-drawn placeholders.
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
  /** Fist with wrench and bananas — the Bureau crest (stamps, headers). */
  crest: ImageSourcePropType | null;
  /** Faceted star with orbiting bananas — achievements only. */
  star: ImageSourcePropType | null;
  /** Welder bust — avatar mark for babushka notes / Bureau bylines. */
  bust: ImageSourcePropType | null;
  /** Fist gripping a peeled banana — the "Поехали" action mark. */
  fist: ImageSourcePropType | null;
  /**
   * Background-removed welder-banana figure, sticker-style cream outline —
   * the "paper cutout" pinned behind the Book header. Not yet delivered.
   */
  cutoutWorker: ImageSourcePropType | null;
}

export const POSTERS: BookPosters = {
  worker: require('../../assets/soviet/poster-worker.jpg'),
  cosmonaut: null,
  gear: require('../../assets/soviet/emblem-gear.jpg'),
  crane: require('../../assets/soviet/loader-crane.jpg'),
  crest: require('../../assets/soviet/crest-bureau.jpg'),
  star: require('../../assets/soviet/medal-star.jpg'),
  bust: require('../../assets/soviet/mark-worker.jpg'),
  fist: require('../../assets/soviet/cta-fist.jpg'),
  // Vision subject-lift from TJ's «НАШ ТРУД» poster, cream sticker outline
  // baked in. Palette-quantized PNG (69KB).
  cutoutWorker: require('../../assets/soviet/cutout-worker.png'),
  // Pending drops (assets/soviet/README.md):
  // cosmonaut: require('../../assets/soviet/poster-cosmonaut.jpg'),
};
