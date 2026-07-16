/**
 * The shared cart mechanics under every restaurant's costume: pick dishes,
 * consolidate ingredients through the Book's thrift solver, launch the plan
 * at the existing POST /carts. Screens own 100% of the presentation; this
 * hook owns the flow, so all three kitchens behave identically underneath.
 */

import { useMemo, useState } from 'react';

import { consolidatePlan, planToLineItems } from './plan';
import { api, getErrorMessage } from '@/lib/api';
import type { CreateCartResponse } from '@/lib/types';

import type { Dish } from './types';

export interface UsePlanOptions {
  dishes: Dish[];
  /** Household to build the cart for; undefined in the signed-out preview. */
  householdId?: string;
  /** Preview mode keeps selection live but scrubs the launch. */
  previewMode?: boolean;
  /** In-house copy shown when a signed-out visitor tries to launch. */
  signedOutMessage: string;
  onCartBuilt?: (result: CreateCartResponse) => void;
}

export function usePlan({
  dishes,
  householdId,
  previewMode = false,
  signedOutMessage,
  onCartBuilt,
}: UsePlanOptions) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(
    () => dishes.filter((dish) => selected.has(dish.id)),
    [dishes, selected],
  );
  const plan = useMemo(() => consolidatePlan(chosen), [chosen]);

  const toggle = (id: string) => {
    setError(null);
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const launch = async () => {
    if (building || chosen.length === 0) return;
    setError(null);

    if (previewMode || !householdId) {
      setError(signedOutMessage);
      return;
    }

    setBuilding(true);
    try {
      const result = await api.createCart({
        household_id: householdId,
        line_items: planToLineItems(plan),
      });
      onCartBuilt?.(result);
      setSelected(new Set());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBuilding(false);
    }
  };

  return { selected, toggle, chosen, plan, building, error, launch };
}
