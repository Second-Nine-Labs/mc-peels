/**
 * Kitchen genesis — the Shelf mints a kitchen.
 *
 * Save enough of one cuisine and a kitchen opens: this module derives
 * restaurants from shelf recipes, entirely client-side. The API already
 * hands back everything needed (recipes carry cuisine, dish_type, native
 * subs, heat, serves, and cartable ingredients); at OPEN_THRESHOLD dishes
 * of one cuisine a full Restaurant materializes and dresses from the
 * costume factory. Below it, a teaser reports the countdown.
 *
 * v1 is deliberately stateless — kitchens exist wherever the shelf data
 * does. Persisted, nameable kitchens (and server-generated costumes) are
 * the v2 on top of this.
 */

import type { SavedRecipe } from '@/lib/types';

import type { Dish, MenuSection, Restaurant } from './types';

/** Saves of one cuisine that open its kitchen. */
export const OPEN_THRESHOLD = 4;
/** Saves at which the home starts teasing the countdown. */
export const TEASE_THRESHOLD = 2;

/** Cuisines that never coalesce into a kitchen. */
const NEVER_A_KITCHEN = new Set(['other']);

/** Menu section order + labels, keyed by the extractor's dish_type. */
const SECTIONS: MenuSection[] = [
  { key: 'main', label: 'MAINS', sub: 'the table' },
  { key: 'soup', label: 'SOUPS', sub: 'the pot' },
  { key: 'salad', label: 'SALADS', sub: 'the cold side' },
  { key: 'side', label: 'SIDES', sub: 'the small plates' },
  { key: 'breakfast', label: 'BREAKFAST', sub: 'the morning' },
  { key: 'snack', label: 'SNACKS', sub: 'the in-between' },
  { key: 'dessert', label: 'DESSERTS', sub: 'the sweet end' },
  { key: 'drink', label: 'DRINKS', sub: 'the glass' },
  { key: 'sauce', label: 'SAUCES', sub: 'the jar' },
];

export const CUISINE_LABELS: Record<string, string> = {
  italian: 'Italian',
  mexican: 'Mexican',
  indian: 'Indian',
  'sichuan-chongqing': 'Sichuan & Chongqing',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  vietnamese: 'Vietnamese',
  mediterranean: 'Mediterranean',
  'middle-eastern': 'Middle Eastern',
  french: 'French',
  'american-comfort': 'American comfort',
  'southern-bbq': 'Southern BBQ',
  latin: 'Latin',
  caribbean: 'Caribbean',
  african: 'African',
  'post-soviet': 'Post-Soviet',
  breakfast: 'Breakfast',
  'baking-dessert': 'Baking & dessert',
};

export function cuisineLabel(cuisine: string): string {
  return CUISINE_LABELS[cuisine] ?? cuisine;
}

export function kitchenIdForCuisine(cuisine: string): string {
  return `shelf-${cuisine}`;
}

export function cuisineForKitchenId(id: string): string | null {
  return id.startsWith('shelf-') ? id.slice('shelf-'.length) : null;
}

/** A kitchen that has opened — a full Restaurant derived from shelf saves. */
export interface DerivedKitchen {
  cuisine: string;
  restaurant: Restaurant;
}

/** A kitchen still under construction — the home teases the countdown. */
export interface KitchenTease {
  cuisine: string;
  label: string;
  saved: number;
  needed: number;
}

export interface Genesis {
  kitchens: DerivedKitchen[];
  teases: KitchenTease[];
}

function toDish(recipe: SavedRecipe): Dish {
  return {
    id: recipe.id,
    name: recipe.title,
    sub: recipe.sub ?? undefined,
    description: recipe.description ?? 'Saved from your shelf.',
    section: recipe.dish_type,
    tags: [recipe.cuisine, recipe.dish_type],
    serves: recipe.serves,
    minutes: recipe.minutes,
    heat: (recipe.heat ?? undefined) as Dish['heat'],
    note: recipe.creator ? `saved from ${recipe.creator}` : undefined,
    artUrl: recipe.art_url,
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity ?? undefined,
      unit: ingredient.unit ?? undefined,
      pantry: ingredient.pantry ?? undefined,
    })),
  };
}

/** Group shelf recipes by cuisine → open kitchens + under-construction teases. */
export function deriveGenesis(recipes: SavedRecipe[]): Genesis {
  const byCuisine = new Map<string, SavedRecipe[]>();
  for (const recipe of recipes) {
    if (NEVER_A_KITCHEN.has(recipe.cuisine)) continue;
    const list = byCuisine.get(recipe.cuisine) ?? [];
    list.push(recipe);
    byCuisine.set(recipe.cuisine, list);
  }

  const kitchens: DerivedKitchen[] = [];
  const teases: KitchenTease[] = [];

  for (const [cuisine, saved] of byCuisine) {
    if (saved.length >= OPEN_THRESHOLD) {
      kitchens.push({ cuisine, restaurant: toRestaurant(cuisine, saved) });
    } else if (saved.length >= TEASE_THRESHOLD) {
      teases.push({
        cuisine,
        label: cuisineLabel(cuisine),
        saved: saved.length,
        needed: OPEN_THRESHOLD - saved.length,
      });
    }
  }

  // Biggest menus first; teases closest-to-opening first.
  kitchens.sort((a, b) => b.restaurant.dishes.length - a.restaurant.dishes.length);
  teases.sort((a, b) => a.needed - b.needed);

  return { kitchens, teases };
}

function toRestaurant(cuisine: string, saved: SavedRecipe[]): Restaurant {
  const dishes = saved.map(toDish);
  const present = new Set(dishes.map((dish) => dish.section));
  const sections = SECTIONS.filter((section) => present.has(section.key));
  const label = cuisineLabel(cuisine);

  return {
    // Restaurant.id is typed to the static trio; derived ids ride the same
    // rails deliberately (routes/costumes key by string).
    id: kitchenIdForCuisine(cuisine) as Restaurant['id'],
    name: label,
    sub: 'from your shelf',
    cuisine: label.toLowerCase(),
    tagline: 'your saves, seated at a table',
    blurb: `Everything ${label} you saved, plated as a menu — every dish carts through your household rules.`,
    meta: `${dishes.length} dishes · opened from the shelf`,
    accent: '#FFC531',
    onAccent: '#1D2433',
    sections,
    dishes,
  };
}
