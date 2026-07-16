/**
 * Eats — the restaurant layer. Three imagined kitchens, one shared contract:
 * every dish resolves to Instacart-searchable ingredients, so any menu can
 * flow through the Book's thrift solver into POST /carts.
 *
 * Restaurants own their vibe end-to-end (palette, type, menu layout live in
 * their screen files); this module only knows the shape of a menu.
 */

import type { CreateCartResponse } from '@/lib/types';

import type { DishIngredient } from './plan';

export type RestaurantId = 'stolovaya-7' | 'greenhouse' | 'la-milpa';

export interface Dish {
  id: string;
  /** English display name — the search anchor. */
  name: string;
  /** Native-script or menu-card secondary name (борщ / El Taco). */
  sub?: string;
  /** One line of menu copy. */
  description: string;
  /** Key into the restaurant's `sections`. */
  section: string;
  /** Search fodder: cuisine words, diet words, moods. Lowercase. */
  tags: string[];
  serves: number;
  minutes: number;
  /** Surfaces on the home "tonight's picks" rail. */
  featured?: boolean;
  /** La Milpa: chile scale, 0–3. */
  heat?: 0 | 1 | 2 | 3;
  /** La Milpa: lotería card number. */
  cardNo?: number;
  /** Greenhouse: macro honesty. */
  kcal?: number;
  protein?: number;
  /** Stolovaya: spec-sheet number (pastiche, not a real standard). */
  gost?: string;
  /** The house voice — babushka, nutritionist, abuela. One line. */
  note?: string;
  /** Generated art URL (shelf-minted dishes) — bundled manifest art wins. */
  artUrl?: string | null;
  ingredients: DishIngredient[];
}

/** Every restaurant screen speaks this contract; the costume is its own. */
export interface RestaurantScreenProps {
  /** Household to build the cart for; undefined in the signed-out preview. */
  householdId?: string;
  /** Preview mode keeps the menu live but scrubs the launch. */
  previewMode?: boolean;
  /** Open this dish's detail on arrival (home search / picks deep link). */
  initialDishId?: string;
  onCartBuilt?: (result: CreateCartResponse) => void;
  onBack?: () => void;
}

export interface MenuSection {
  key: string;
  label: string;
  sub?: string;
}

export interface Restaurant {
  id: RestaurantId;
  name: string;
  /** Translated / secondary name for the home card. */
  sub?: string;
  cuisine: string;
  tagline: string;
  /** Home-card copy — one warm sentence. */
  blurb: string;
  /** Home-card meta line ("12 dishes · the daily decree"). */
  meta: string;
  /** Brand accent for home cards and search chips. */
  accent: string;
  onAccent: string;
  sections: MenuSection[];
  dishes: Dish[];
}
