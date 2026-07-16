/**
 * Shelf-kitchen hooks — fetch the household's shelf, run genesis, hand back
 * opened kitchens + teases. Preview surfaces inject sample recipes instead
 * of fetching, so the signed-out showcase can demo a minted kitchen.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import type { SavedRecipe } from '@/lib/types';

import { costumeForShelfKitchen } from './costumes/factory';
import type { KitchenCostume } from './costume';
import { cuisineForKitchenId, deriveGenesis, type Genesis } from './genesis';

const EMPTY: Genesis = { kitchens: [], teases: [] };

/** Once per app session per save — nudge the API to generate missing art.
 * Fire-and-forget: results land in recipes.art_url and show on the next
 * shelf fetch (screens refetch on focus). Failed saves are not re-kicked;
 * rerolls are an explicit force on the endpoint. */
const artKicked = new Set<string>();
function kickArtGeneration(recipes: SavedRecipe[]): void {
  for (const recipe of recipes) {
    if (recipe.art_url || recipe.art_status === 'failed' || artKicked.has(recipe.id)) continue;
    artKicked.add(recipe.id);
    api.ensureRecipeArt(recipe.id).catch(() => {
      // Art is a garnish — generation trouble never surfaces on the shelf.
    });
  }
}

export interface UseShelfKitchensOptions {
  householdId?: string;
  /** Preview surfaces pass sample recipes; no network is touched. */
  previewRecipes?: SavedRecipe[];
}

export function useShelfKitchens({ householdId, previewRecipes }: UseShelfKitchensOptions): Genesis {
  const [fetched, setFetched] = useState<SavedRecipe[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (previewRecipes || !householdId) return;
      let cancelled = false;
      api
        .listRecipes({ household_id: householdId })
        .then((data) => {
          if (cancelled) return;
          setFetched(data.recipes);
          kickArtGeneration(data.recipes);
        })
        .catch(() => {
          // The shelf being unreachable never breaks the home — no kitchens, no teases.
        });
      return () => {
        cancelled = true;
      };
    }, [householdId, previewRecipes]),
  );

  return useMemo(() => {
    const recipes = previewRecipes ?? fetched;
    return recipes ? deriveGenesis(recipes) : EMPTY;
  }, [previewRecipes, fetched]);
}

export interface DerivedKitchenState {
  costume: KitchenCostume | null;
  loading: boolean;
}

/** Resolve one shelf-born kitchen by route id (`shelf-<cuisine>`). */
export function useDerivedKitchen(
  kitchenId: string | undefined,
  householdId: string | undefined,
): DerivedKitchenState {
  const cuisine = kitchenId ? cuisineForKitchenId(kitchenId) : null;
  const [state, setState] = useState<DerivedKitchenState>({ costume: null, loading: !!cuisine });

  useFocusEffect(
    useCallback(() => {
      if (!cuisine || !householdId) return;
      let cancelled = false;
      setState((previous) => (previous.costume ? previous : { ...previous, loading: true }));
      api
        .listRecipes({ household_id: householdId })
        .then((data) => {
          if (cancelled) return;
          kickArtGeneration(data.recipes);
          const kitchen = deriveGenesis(data.recipes).kitchens.find(
            (entry) => entry.cuisine === cuisine,
          );
          setState({
            costume: kitchen ? costumeForShelfKitchen(kitchen.cuisine, kitchen.restaurant) : null,
            loading: false,
          });
        })
        .catch(() => {
          if (!cancelled) setState({ costume: null, loading: false });
        });
      return () => {
        cancelled = true;
      };
    }, [cuisine, householdId]),
  );

  if (!cuisine) return { costume: null, loading: false };
  return state;
}
