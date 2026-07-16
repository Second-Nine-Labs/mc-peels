/**
 * Starter catalog integrity — the onboarding picker and genesis both trust
 * this data, so the catalog is held to the extractor's own standards.
 */

import { describe, expect, it } from 'vitest';
import { RECIPE_CUISINES, RECIPE_DISH_TYPES } from '../src/ai/recipe-extractor.js';
import { STARTER_CATALOG, starterById, starterSourceUrl } from '../src/core/starters.js';

const CUISINE_SET = new Set<string>(RECIPE_CUISINES);
const DISH_TYPE_SET = new Set<string>(RECIPE_DISH_TYPES);

describe('STARTER_CATALOG', () => {
  it('has unique ids and source urls', () => {
    const ids = STARTER_CATALOG.map((dish) => dish.id);
    expect(new Set(ids).size).toBe(ids.length);
    const urls = STARTER_CATALOG.map((dish) => starterSourceUrl(dish.id));
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(url).toMatch(/^mcpeels:\/\/starter\/[a-z0-9-]+$/);
  });

  it('speaks the extractor vocabulary exactly', () => {
    for (const dish of STARTER_CATALOG) {
      expect(CUISINE_SET.has(dish.cuisine), `${dish.id} cuisine ${dish.cuisine}`).toBe(true);
      expect(DISH_TYPE_SET.has(dish.dishType), `${dish.id} dish_type ${dish.dishType}`).toBe(true);
    }
  });

  it('never coalesces into the void — no "other" cuisine', () => {
    for (const dish of STARTER_CATALOG) expect(dish.cuisine).not.toBe('other');
  });

  it('gives every cuisine group enough dishes to open a kitchen (3+)', () => {
    const counts = new Map<string, number>();
    for (const dish of STARTER_CATALOG) {
      counts.set(dish.cuisine, (counts.get(dish.cuisine) ?? 0) + 1);
    }
    expect(counts.size).toBeGreaterThanOrEqual(4);
    for (const [cuisine, count] of counts) {
      expect(count, `${cuisine} has only ${count} starter(s)`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every dish cookable and cartable', () => {
    for (const dish of STARTER_CATALOG) {
      expect(dish.title.length, dish.id).toBeGreaterThan(0);
      expect(dish.description.length, dish.id).toBeGreaterThan(0);
      expect(dish.serves, dish.id).toBeGreaterThanOrEqual(1);
      expect(dish.minutes, dish.id).toBeGreaterThanOrEqual(5);
      if (dish.heat !== null) {
        expect(dish.heat, dish.id).toBeGreaterThanOrEqual(0);
        expect(dish.heat, dish.id).toBeLessThanOrEqual(3);
      }
      expect(dish.steps.length, dish.id).toBeGreaterThanOrEqual(2);

      // At least two real (non-pantry) items, or the cart is a shrug.
      const shopping = dish.ingredients.filter((ingredient) => ingredient.pantry !== true);
      expect(shopping.length, dish.id).toBeGreaterThanOrEqual(2);

      for (const ingredient of dish.ingredients) {
        expect(ingredient.name.trim().length, dish.id).toBeGreaterThan(0);
        // Pantry staples carry no quantities; real items carry purchasable ones.
        if (ingredient.pantry === true) {
          expect(ingredient.quantity, `${dish.id}: ${ingredient.name}`).toBeUndefined();
        } else {
          expect(ingredient.quantity, `${dish.id}: ${ingredient.name}`).toBeGreaterThan(0);
          expect(
            typeof ingredient.unit === 'string' && ingredient.unit.length > 0,
            `${dish.id}: ${ingredient.name} unit`,
          ).toBe(true);
        }
      }
    }
  });
});

describe('starterById', () => {
  it('resolves known ids and rejects unknowns', () => {
    expect(starterById('xiaomian')?.cuisine).toBe('sichuan-chongqing');
    expect(starterById('borscht')?.dishType).toBe('soup');
    expect(starterById('nope')).toBeNull();
  });
});
