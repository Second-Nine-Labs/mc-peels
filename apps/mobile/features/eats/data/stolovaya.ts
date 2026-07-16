/**
 * «Столовая № 7» — the Bureau's canteen. Twelve dishes of the post-Soviet
 * table, re-served as a daily menu document. Tone rules: punch at bureaucracy
 * and aesthetics, never at hardship or people.
 */

import { CANON, type CanonCategory } from './stolovaya-canon';

import type { Dish, Restaurant } from '../types';

const SECTION_FOR: Record<CanonCategory, string> = {
  soup: 'pervye',
  main: 'vtorye',
  breakfast: 'zavtrak',
  salad: 'salaty',
};

/** Honest stove-time estimates — the canon predates the clock. */
const MINUTES: Record<string, number> = {
  plov: 90,
  borscht: 75,
  pelmeni: 60,
  syrniki: 30,
  olivier: 45,
  vinaigrette: 40,
  golubtsy: 90,
  grechka: 35,
  blini: 40,
  okroshka: 25,
  kotleti: 50,
  khachapuri: 75,
};

const FEATURED = new Set(['borscht', 'khachapuri']);

const dishes: Dish[] = CANON.map((recipe) => ({
  id: recipe.id,
  name: recipe.name,
  sub: recipe.cyrillic,
  description: recipe.story,
  section: SECTION_FOR[recipe.category],
  tags: [recipe.origin.toLowerCase(), recipe.category, 'comfort'],
  serves: recipe.serves,
  minutes: MINUTES[recipe.id] ?? 60,
  featured: FEATURED.has(recipe.id),
  gost: recipe.gost,
  note: recipe.note,
  ingredients: recipe.ingredients,
}));

export const STOLOVAYA: Restaurant = {
  id: 'stolovaya-7',
  name: 'Столовая № 7',
  sub: 'Canteen No. 7',
  cuisine: 'Post-Soviet comfort',
  tagline: 'The menu is a decree. Dinner is a plan.',
  blurb:
    'The Bureau’s canteen — twelve dishes of the post-Soviet table, typed onto the day’s official menu.',
  meta: '12 dishes · the daily decree',
  accent: '#2E509F',
  onAccent: '#F2E8D5',
  sections: [
    { key: 'pervye', label: 'ПЕРВЫЕ БЛЮДА', sub: 'first courses' },
    { key: 'vtorye', label: 'ВТОРЫЕ БЛЮДА', sub: 'second courses' },
    { key: 'zavtrak', label: 'ЗАВТРАК', sub: 'breakfast' },
    { key: 'salaty', label: 'САЛАТЫ', sub: 'salads' },
  ],
  dishes,
};
