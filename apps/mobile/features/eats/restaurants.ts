/**
 * Cross-kitchen search. There is no pre-built catalog anymore — every kitchen
 * grows from the household's shelf — so search runs over the user's own
 * kitchens: dish name, native sub, tag, or ingredient, each hit labeled with
 * *why* it matched so results read like answers, not luck.
 */

import type { Dish, Restaurant } from './types';

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

export function searchEats(query: string, kitchens: Restaurant[]): EatsSearchResult {
  const needle = query.trim().toLowerCase();
  if (!needle) return { restaurants: [], dishes: [] };

  const restaurants = kitchens.filter((restaurant) =>
    [restaurant.name, restaurant.sub ?? '', restaurant.cuisine, restaurant.tagline]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );

  const dishes: DishHit[] = [];
  for (const restaurant of kitchens) {
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
