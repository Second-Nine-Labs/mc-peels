/**
 * Prompt construction for generated dish art — pure functions, unit-tested.
 *
 * Every cuisine gets a "style lock": one rendering language per kitchen so a
 * menu reads as one artist's work. House rules ride on every prompt: no
 * lettering (type is always set in the app), no emoji, one centered subject.
 */

export interface StyleLock {
  /** Slug recorded for bookkeeping; bump the suffix to force a new look. */
  key: string;
  /** The style clause appended to every dish prompt in this cuisine. */
  style: string;
}

const HOUSE_RULES =
  'no text, no lettering, no watermarks, no emoji, a single dish centered with breathing room, square composition';

/** 山城's blueprint — Chongqing night-market photography. */
const NIGHT_MARKET: StyleLock = {
  key: 'night-market-v1',
  style:
    'dramatic dark food photography, deep plum-black night-market backdrop, red lantern glow from above, visible steam, glistening chili-oil sheen, hard cinematic rim light, rich and moody',
};

/** Default for any other shelf-minted kitchen: premium dark photography that
 * sits well on the factory costume's dark canvas. */
const DEFAULT_LOCK: StyleLock = {
  key: 'dark-premium-v1',
  style:
    'dramatic dark food photography, deep charcoal backdrop, one warm directional key light, visible steam, shallow depth of field, rich and appetizing, cinematic',
};

const LOCKS: Record<string, StyleLock> = {
  'sichuan-chongqing': NIGHT_MARKET,
};

export function styleLockForCuisine(cuisine: string): StyleLock {
  return LOCKS[cuisine] ?? DEFAULT_LOCK;
}

export interface DishForArt {
  title: string;
  sub?: string | null;
  description?: string | null;
  cuisine: string;
}

/** The full generation prompt for one dish tile. */
export function dishArtPrompt(dish: DishForArt): string {
  const lock = styleLockForCuisine(dish.cuisine);
  const subject = [
    dish.sub ? `${dish.title} (${dish.sub})` : dish.title,
    dish.description ?? null,
  ]
    .filter(Boolean)
    .join(' — ');
  return `Appetizing food photograph of ${subject}, ${lock.style}, ${HOUSE_RULES}`;
}

/** The judge's rubric — strict by design; a false fail costs one reroll. */
export function judgeRubric(dish: { title: string; description?: string | null }, style: string): string {
  return [
    `You are grading a generated menu tile for the dish "${dish.title}"` +
      (dish.description ? ` (${dish.description})` : '') +
      '. Fail it if ANY of the following are true:',
    `1. The image does not clearly depict ${dish.title}.`,
    '2. Any text, lettering, numbers, logos, or watermarks appear anywhere in the image.',
    '3. Any emoji or emoji-like glyphs appear.',
    '4. The food or scene is deformed, unappetizing, or shows generation artifacts (melted shapes, impossible utensils, mangled anatomy).',
    `5. The style is clearly off-brief — expected: ${style}.`,
    'Grade strictly; when uncertain, fail it and say why.',
  ].join('\n');
}
