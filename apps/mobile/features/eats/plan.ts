/**
 * The thrift solver — consolidation across a selected plan of dishes.
 *
 * Generic planners optimize variety; this optimizes stretch: one cabbage,
 * several dinners. Anything with a name and an ingredient list can join a
 * plan (a shelf dish, a kitchen dish), and the consolidated result maps
 * straight to POST /carts line_items.
 *
 * (Relocated out of the retired Book playground — this is core Eats
 * infrastructure, not Soviet-recipe content.)
 */

/** One stored ingredient — the shape a Dish carries and the plan consolidates. */
export interface DishIngredient {
  /** Clean product name suitable for Instacart store search. */
  name: string;
  quantity?: number;
  unit?: string;
  /** Assumed on-hand (salt, oil, spices) — excluded from the cart by default. */
  pantry?: boolean;
}

export interface PlanItem {
  name: string;
  /** Summed when every use agrees on the unit; null means "sizes differ — human resolves at the store". */
  quantity: number | null;
  unit: string | null;
  /** Dish names this item serves — length ≥ 2 means it works a double shift. */
  usedBy: string[];
}

export interface ConsolidatedPlan {
  /** Cart-bound items, shared workers first. */
  items: PlanItem[];
  /** Distinct items serving 2+ dishes. */
  sharedCount: number;
  /** Sum of every (item, dish) pairing — the "uses" the cart covers. */
  totalUses: number;
  /** Pantry staples assumed on hand (not sent to the cart). */
  pantryAssumed: string[];
}

/** Anything with a name and an ingredient list can join a plan. */
export interface PlanSource {
  name: string;
  ingredients: DishIngredient[];
}

export function consolidatePlan(sources: PlanSource[]): ConsolidatedPlan {
  const byKey = new Map<string, PlanItem>();
  const pantry = new Set<string>();
  let totalUses = 0;

  for (const source of sources) {
    for (const ingredient of source.ingredients) {
      if (ingredient.pantry) {
        pantry.add(ingredient.name);
        continue;
      }
      totalUses += 1;
      const key = ingredient.name.trim().toLowerCase();
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          name: ingredient.name,
          quantity: ingredient.quantity ?? null,
          unit: ingredient.unit ?? null,
          usedBy: [source.name],
        });
        continue;
      }
      existing.usedBy.push(source.name);
      // Sum only when units agree; disagreement degrades honestly to "unsized".
      if (
        existing.quantity !== null &&
        ingredient.quantity !== undefined &&
        existing.unit === (ingredient.unit ?? null)
      ) {
        existing.quantity = roundQuantity(existing.quantity + ingredient.quantity);
      } else {
        existing.quantity = null;
        existing.unit = null;
      }
    }
  }

  const items = [...byKey.values()].sort(
    (a, b) => b.usedBy.length - a.usedBy.length || a.name.localeCompare(b.name),
  );
  return {
    items,
    sharedCount: items.filter((item) => item.usedBy.length >= 2).length,
    totalUses,
    pantryAssumed: [...pantry].sort(),
  };
}

/** 1.5 + 1.5 must read 3, not 2.9999999999999996. */
function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The consolidated plan as POST /carts line_items. */
export function planToLineItems(
  plan: ConsolidatedPlan,
): Array<{ name: string; quantity?: number; unit?: string }> {
  return plan.items.map((item) => ({
    name: item.name,
    quantity: item.quantity ?? undefined,
    unit: item.unit ?? undefined,
  }));
}
