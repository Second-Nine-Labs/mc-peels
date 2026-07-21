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

/** What a kitchen's images are MADE of. */
export type ArtMedium = 'photograph' | 'illustration';

export interface StyleLock {
  /** Slug recorded for bookkeeping; bump the suffix to force a new look. */
  key: string;
  /**
   * The one hard constraint: medium is consistent WITHIN a kitchen. Both the
   * dish tiles and the hero read this, so a kitchen cannot be illustrated on
   * its menu and photographic on its backdrop.
   */
  medium: ArtMedium;
  /** The medium + style clause for a dish tile; leads the prompt. */
  style: string;
  /**
   * The same look applied to a wide establishing shot of the room. Not a
   * separate aesthetic — the same artist, stepping back from the plate.
   */
  hero: string;
}

const HOUSE_RULES =
  'no text, no lettering, no watermarks, no emoji, a single dish centered with breathing room, square composition';

/** Столовая № 7 — flat-ink Soviet poster plates (the «НАШ ТРУД» language). */
const SOVIET_POSTER: StyleLock = {
  key: 'soviet-poster-v1',
  medium: 'illustration',
  style:
    '1960s Soviet propaganda-poster food illustration, flat ink printing style, bold black keyline, limited palette of faded red #C8332B, cream paper #F2E8D5, ochre and olive, slight misregistration and aged-paper grain, heroic composition from a low angle',
  hero:
    '1960s Soviet propaganda-poster illustration of a workers\' canteen interior, flat ink printing style, bold black keyline, limited palette of faded red #C8332B, cream paper #F2E8D5, ochre and olive, slight misregistration and aged-paper grain, wide heroic interior from a low angle',
};

/** greenhouse — bright overhead market photography on warm white. */
const GREENHOUSE_PHOTO: StyleLock = {
  key: 'greenhouse-photo-v1',
  medium: 'photograph',
  style:
    'bright overhead food photography on warm white marble, soft diffused morning window light, a sage-green linen napkin at the edge of frame, shallow depth of field, generous airy negative space, fresh and appetizing',
  hero:
    'bright airy editorial interior photography, soft diffused morning daylight through tall glasshouse panes, warm white marble and pale wood, sage-green linen, trailing plants, shallow depth of field, generous negative space, fresh inviting and premium',
};

/** La Milpa — vibrant mercado-poster gouache. */
const MERCADO_GOUACHE: StyleLock = {
  key: 'mercado-gouache-v1',
  medium: 'illustration',
  style:
    'vibrant Mexican mercado-poster gouache illustration, flat saturated shapes in marigold #F2A007, rosa mexicano #E84B8A, teal #159F94 and deep plum #241430, thick paint texture, papel-picado energy, festive but composed',
  hero:
    'vibrant Mexican mercado-poster gouache illustration of a market fonda interior, flat saturated shapes in marigold #F2A007, rosa mexicano #E84B8A, teal #159F94 and deep plum #241430, thick visible brush texture, papel-picado strung overhead, wide festive interior, composed',
};

/** 山城 — Chongqing night-market photography. */
const NIGHT_MARKET: StyleLock = {
  key: 'night-market-v1',
  medium: 'photograph',
  style:
    'dramatic dark food photography, deep plum-black night-market backdrop, red lantern glow from above, visible steam, glistening chili-oil sheen, hard cinematic rim light, rich and moody',
  hero:
    'moody cinematic interior photography of a Chongqing night-market stall, deep plum-black surroundings, red lantern glow from above, drifting steam, wet reflective surfaces, hard rim light, intimate late-evening atmosphere, premium',
};

/**
 * Fallbacks for a kitchen with no named lock — both photography, split by the
 * palette mode so the art and the room agree on tone.
 *
 * These two are the reason `styleLock` takes a mode. A named lock commits to
 * one look and ignores it; only the unnamed case has a tone left to decide.
 */
const DEFAULT_DARK: StyleLock = {
  key: 'dark-premium-v1',
  medium: 'photograph',
  style:
    'dramatic dark food photography, deep charcoal backdrop, one warm directional key light, visible steam, shallow depth of field, rich and appetizing, cinematic',
  hero:
    'moody cinematic interior photography, warm low-key lighting, deep shadows, a single glowing source, rich lacquered surfaces, intimate late-evening atmosphere, premium',
};

const DEFAULT_LIGHT: StyleLock = {
  key: 'light-premium-v1',
  medium: 'photograph',
  style:
    'bright natural food photography, warm white backdrop, soft diffused daylight, pale wood and ceramic, shallow depth of field, generous airy negative space, fresh and appetizing',
  hero:
    'bright airy editorial interior photography, soft diffused daylight through a window, warm natural materials — pale wood, linen, ceramic — shallow depth of field, generous negative space, fresh inviting and premium',
};

/**
 * Every lock that exists — the bounded vocabulary a kitchen can wear.
 *
 * Weighted toward photography (4 of 6): illustration stays reachable but is
 * the exception, not the house style. No per-cuisine rules live here; a
 * cuisine reaches a lock through LOCKS below, never the other way round.
 */
export const ALL_LOCKS: readonly StyleLock[] = [
  SOVIET_POSTER,
  GREENHOUSE_PHOTO,
  MERCADO_GOUACHE,
  NIGHT_MARKET,
  DEFAULT_DARK,
  DEFAULT_LIGHT,
];

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

/**
 * Resolve a kitchen's look.
 *
 * `mode` only decides the FALLBACK's tone; a named lock has already committed
 * to one. It defaults to 'dark' so callers that do not know the palette (dish
 * tiles today) keep the behaviour they had.
 */
export function styleLock(key: string, mode: 'light' | 'dark' = 'dark'): StyleLock {
  return LOCKS[key] ?? (mode === 'light' ? DEFAULT_LIGHT : DEFAULT_DARK);
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
// eatery, not a centered dish. It takes the kitchen's own style lock, so its
// medium is the same one the menu tiles are drawn in.
//
// It did not always. The scene string used to hardcode the word "photograph"
// and append a clause chosen by the PALETTE MODE, which returned one of two
// strings — both explicitly photography. So a kitchen whose tiles are flat-ink
// illustration (Столовая) got a photographic hero, and `heroJudgeRubric`
// graded against that same photographic brief and rerolled anything else. The
// contradiction was masked only because every shelf-minted kitchen fell
// through to one dark-photography default, so hero and tiles agreed by
// accident.

const HERO_HOUSE_RULES =
  'no text, no lettering, no signage words, no numbers, no logos, no watermarks, no emoji, no menus, no readable human faces, wide atmospheric establishing composition with calm negative space toward the lower-left for a title';

export interface HeroForArt {
  /** Human cuisine label woven into the scene ("Thai", "Levantine"). */
  cuisineLabel: string;
  /** Kitchen id (static trio) or cuisine (shelf-minted) — resolves the lock. */
  styleKey: string;
  /** Palette mode — only breaks the tie for kitchens with no named lock. */
  mode: 'light' | 'dark';
  /** The kitchen's tagline/mood, if any — nudges the atmosphere. */
  mood?: string | null;
}

/** The full generation prompt for a kitchen hero backdrop. */
export function heroArtPrompt(hero: HeroForArt): string {
  const lock = styleLock(hero.styleKey, hero.mode);
  const scene =
    `An atmospheric establishing ${lock.medium} of an intimate ${hero.cuisineLabel} eatery interior — ` +
    'the counter, a set table, and the light that makes it feel like a real, beloved place';
  return `${scene}${hero.mood ? `, ${hero.mood}` : ''}. ${lock.hero}, ${HERO_HOUSE_RULES}`;
}

/**
 * The hero judge's rubric — scene-oriented (no "depict this dish" clause), and
 * graded against the kitchen's OWN lock.
 *
 * The medium is stated outright and defended in both directions. The previous
 * rubric described a photographic brief unconditionally, so an illustrated
 * hero was failed as off-brief and rerolled — the judge actively enforced the
 * mismatch it was supposed to catch.
 */
export function heroJudgeRubric(subject: string, lock: Pick<StyleLock, 'medium' | 'hero'>): string {
  return [
    `You are grading a generated hero backdrop for a ${subject} kitchen.`,
    `This kitchen's medium is ${lock.medium.toUpperCase()}. Grade it as that medium: do not fail an illustration for being unphotographic, and do not fail a photograph for lacking illustrative styling.`,
    'Fail it if ANY of the following are true:',
    '1. Any text, lettering, numbers, logos, signage words, or watermarks appear anywhere in the image.',
    '2. Any emoji or emoji-like glyphs appear.',
    '3. The scene is deformed or shows generation artifacts (melted shapes, impossible architecture, mangled hands or anatomy).',
    '4. A human face is a dominant, in-focus subject (a distant, out-of-focus figure is acceptable).',
    `5. The setting is clearly off-brief — expected: an atmospheric ${subject} eatery interior.`,
    `6. The rendering is clearly off-brief for its medium — expected: ${lock.hero}.`,
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
