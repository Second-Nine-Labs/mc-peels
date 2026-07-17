/**
 * Prompt construction for generated dish art — pure functions, unit-tested.
 *
 * Every kitchen gets a "style lock": one rendering language so a menu reads
 * as one artist's work. The lock owns the *medium* too — Столов-poster ink,
 * greenhouse photography, La Milpa gouache, 山城 night-market — so the prompt
 * never forces "photograph" onto an illustrated kitchen.
 *
 * A lock resolves by style key, which is a kitchen id for the static trio
 * (`stolovaya-7`, `greenhouse`, `la-milpa`) or a cuisine for shelf-minted
 * kitchens (`sichuan-chongqing`, …). One registry, every restaurant.
 *
 * House rules ride on every prompt: no lettering (type is always set in the
 * app), no emoji, one centered subject.
 */

export interface StyleLock {
  /** Slug recorded for bookkeeping; bump the suffix to force a new look. */
  key: string;
  /** The medium + style clause; leads the prompt, so it sets the medium. */
  style: string;
}

const HOUSE_RULES =
  'no text, no lettering, no watermarks, no emoji, a single dish centered with breathing room, square composition';

/** Столовая № 7 — flat-ink Soviet poster plates (the «НАШ ТРУД» language). */
const SOVIET_POSTER: StyleLock = {
  key: 'soviet-poster-v1',
  style:
    '1960s Soviet propaganda-poster food illustration, flat ink printing style, bold black keyline, limited palette of faded red #C8332B, cream paper #F2E8D5, ochre and olive, slight misregistration and aged-paper grain, heroic composition from a low angle',
};

/** greenhouse — bright overhead market photography on warm white. */
const GREENHOUSE_PHOTO: StyleLock = {
  key: 'greenhouse-photo-v1',
  style:
    'bright overhead food photography on warm white marble, soft diffused morning window light, a sage-green linen napkin at the edge of frame, shallow depth of field, generous airy negative space, fresh and appetizing',
};

/** La Milpa — vibrant mercado-poster gouache. */
const MERCADO_GOUACHE: StyleLock = {
  key: 'mercado-gouache-v1',
  style:
    'vibrant Mexican mercado-poster gouache illustration, flat saturated shapes in marigold #F2A007, rosa mexicano #E84B8A, teal #159F94 and deep plum #241430, thick paint texture, papel-picado energy, festive but composed',
};

/** 山城 — Chongqing night-market photography. */
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

/** Resolved by kitchen id (static trio) or cuisine (shelf-minted). */
const LOCKS: Record<string, StyleLock> = {
  // static trio — keyed by kitchen id
  'stolovaya-7': SOVIET_POSTER,
  greenhouse: GREENHOUSE_PHOTO,
  'la-milpa': MERCADO_GOUACHE,
  // cuisine aliases so a shelf save in the same tradition matches its kitchen
  'post-soviet': SOVIET_POSTER,
  mexican: MERCADO_GOUACHE,
  'sichuan-chongqing': NIGHT_MARKET,
};

export function styleLock(key: string): StyleLock {
  return LOCKS[key] ?? DEFAULT_LOCK;
}

/** @deprecated name — kept for callers/tests; styleLock takes any style key. */
export const styleLockForCuisine = styleLock;

export interface DishForArt {
  title: string;
  sub?: string | null;
  description?: string | null;
  /** Kitchen id (static trio) or cuisine (shelf-minted). */
  styleKey: string;
}

/** The full generation prompt for one dish tile. The style lock leads, so it
 * — not a hardcoded "photograph" — decides the medium. */
export function dishArtPrompt(dish: DishForArt): string {
  const lock = styleLock(dish.styleKey);
  const subject = [
    dish.sub ? `${dish.title} (${dish.sub})` : dish.title,
    dish.description ?? null,
  ]
    .filter(Boolean)
    .join(' — ');
  return `${subject}. ${lock.style}, ${HOUSE_RULES}`;
}

// ---------------------------------------------------------------------------
// Kitchen hero backdrop (Stage 3) — an atmospheric *establishing* shot of the
// eatery, not a centered dish. Its medium follows the generated palette's
// mode so the photo and the room's colors read as one place.

const HERO_HOUSE_RULES =
  'no text, no lettering, no signage words, no numbers, no logos, no watermarks, no emoji, no menus, no readable human faces, wide atmospheric establishing composition with calm negative space toward the lower-left for a title';

const HERO_LIGHT =
  'bright airy editorial interior photography, soft diffused daylight through a window, warm natural materials — pale wood, linen, ceramic — shallow depth of field, generous negative space, fresh inviting and premium';

const HERO_DARK =
  'moody cinematic interior photography, warm low-key lighting, deep shadows, a single glowing source, rich lacquered surfaces, intimate late-evening atmosphere, premium';

/** The hero's base medium, chosen by the palette mode so photo + room agree. */
export function heroStyle(mode: 'light' | 'dark'): string {
  return mode === 'dark' ? HERO_DARK : HERO_LIGHT;
}

export interface HeroForArt {
  /** Human cuisine label woven into the scene ("Thai", "Levantine"). */
  cuisineLabel: string;
  /** Palette mode — steers the medium (light/airy vs moody/dark). */
  mode: 'light' | 'dark';
  /** The kitchen's tagline/mood, if any — nudges the atmosphere. */
  mood?: string | null;
}

/** The full generation prompt for a kitchen hero backdrop. */
export function heroArtPrompt(hero: HeroForArt): string {
  const scene =
    `An atmospheric establishing photograph of an intimate ${hero.cuisineLabel} eatery interior — ` +
    'the counter, a set table, and the light that makes it feel like a real, beloved place';
  return `${scene}${hero.mood ? `, ${hero.mood}` : ''}. ${heroStyle(hero.mode)}, ${HERO_HOUSE_RULES}`;
}

/** The hero judge's rubric — scene-oriented (no "depict this dish" clause). */
export function heroJudgeRubric(subject: string, style: string): string {
  return [
    `You are grading a generated hero backdrop for a ${subject} kitchen. Fail it if ANY of the following are true:`,
    '1. Any text, lettering, numbers, logos, signage words, or watermarks appear anywhere in the image.',
    '2. Any emoji or emoji-like glyphs appear.',
    '3. The scene is deformed or shows generation artifacts (melted shapes, impossible architecture, mangled hands or anatomy).',
    '4. A human face is a dominant, in-focus subject (a distant, out-of-focus figure is acceptable).',
    `5. The setting or style is clearly off-brief — expected: an atmospheric ${subject} eatery interior, ${style}.`,
    'Grade strictly; when uncertain, fail it and say why.',
  ].join('\n');
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
