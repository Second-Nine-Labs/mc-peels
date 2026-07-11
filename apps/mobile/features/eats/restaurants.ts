/**
 * The Eats registry — every imagined restaurant, plus cross-menu search.
 * Home searches here by dish name, tag, ingredient, or restaurant.
 */

import { GREENHOUSE } from './data/greenhouse';
import { LA_MILPA } from './data/lamilpa';
import { STOLOVAYA } from './data/stolovaya';
import type { Dish, Restaurant, RestaurantId } from './types';

export const RESTAURANTS: Restaurant[] = [STOLOVAYA, GREENHOUSE, LA_MILPA];

export function restaurantById(id: string | undefined): Restaurant | null {
  return RESTAURANTS.find((restaurant) => restaurant.id === id) ?? null;
}

/** Featured dishes across every kitchen — the home "tonight's picks" rail. */
export const FEATURED_PICKS: Array<{ dish: Dish; restaurant: Restaurant }> = RESTAURANTS.flatMap(
  (restaurant) =>
    restaurant.dishes
      .filter((dish) => dish.featured)
      .map((dish) => ({ dish, restaurant })),
);

// ---------------------------------------------------------------------------
// Search: one needle, three menus. Matches are labeled with *why* they hit
// (name, tag, or ingredient) so the results read like answers, not luck.

export interface DishHit {
  dish: Dish;
  restaurant: Restaurant;
  /** null when the name itself matched; otherwise a human reason. */
  reason: string | null;
}

export interface EatsSearchResult {
  restaurants: Restaurant[];
  dishes: DishHit[];
}

const MAX_DISH_HITS = 14;

export function searchEats(query: string): EatsSearchResult {
  const needle = query.trim().toLowerCase();
  if (!needle) return { restaurants: [], dishes: [] };

  const restaurants = RESTAURANTS.filter((restaurant) =>
    [restaurant.name, restaurant.sub ?? '', restaurant.cuisine, restaurant.tagline]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );

  const dishes: DishHit[] = [];
  for (const restaurant of RESTAURANTS) {
    for (const dish of restaurant.dishes) {
      const hit = matchDish(dish, restaurant, needle);
      if (hit) dishes.push(hit);
    }
  }
  // Name matches first, then tag/ingredient matches.
  dishes.sort((a, b) => Number(a.reason !== null) - Number(b.reason !== null));

  return { restaurants, dishes: dishes.slice(0, MAX_DISH_HITS) };
}

function matchDish(dish: Dish, restaurant: Restaurant, needle: string): DishHit | null {
  if (
    dish.name.toLowerCase().includes(needle) ||
    (dish.sub ?? '').toLowerCase().includes(needle)
  ) {
    return { dish, restaurant, reason: null };
  }
  const tag = dish.tags.find((entry) => entry.includes(needle));
  if (tag) return { dish, restaurant, reason: `tagged “${tag}”` };
  const ingredient = dish.ingredients.find((entry) =>
    entry.name.toLowerCase().includes(needle),
  );
  if (ingredient) return { dish, restaurant, reason: `made with ${ingredient.name}` };
  return null;
}
