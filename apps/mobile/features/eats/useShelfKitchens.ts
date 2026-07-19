/**
 * Shelf-kitchen hooks — fetch the household's shelf + generated identities,
 * run genesis, hand back opened kitchens + teases. Preview surfaces inject
 * sample recipes (and optional sample identities) instead of fetching, so the
 * signed-out showcase can demo a minted kitchen.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { api } from '@/lib/api';
import type { SavedRecipe } from '@/lib/types';

import type { KitchenCostume } from './costume';
import { costumeForShelfKitchen, flagshipIdentity } from './costumes/factory';
import {
  cuisineForKitchenId,
  cuisineLabel,
  deriveGenesis,
  type DerivedKitchen,
  type Genesis,
} from './genesis';
import { type GeneratedIdentity, identityFromWire, identityMap } from './identity';

const EMPTY: Genesis = { kitchens: [], teases: [] };
const NO_IDENTITIES: Record<string, GeneratedIdentity> = {};

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

/** Once per session per (household, cuisine) — mint the identity for an opened,
 * non-flagship kitchen that doesn't have one yet. The ensure returns the
 * identity (name/voice/palette); the hero image follows in the background and
 * lands on a later fetch. Merges the result so the kitchen dresses without a
 * refetch. */
const identityKicked = new Set<string>();
function kickIdentityGeneration(
  householdId: string,
  kitchens: DerivedKitchen[],
  known: Record<string, GeneratedIdentity>,
  onMinted: (identity: GeneratedIdentity) => void,
): void {
  for (const { cuisine, restaurant } of kitchens) {
    if (flagshipIdentity(cuisine)) continue; // flagships wear hand-built costumes
    if (known[cuisine]) continue; // already minted
    const key = `${householdId}:${cuisine}`;
    if (identityKicked.has(key)) continue;
    identityKicked.add(key);
    api
      .ensureKitchenIdentity({
        household_id: householdId,
        cuisine,
        cuisine_label: cuisineLabel(cuisine),
        dishes: restaurant.dishes.map((dish) => dish.name),
      })
      .then((res) => onMinted(identityFromWire(res.identity)))
      .catch(() => {
        // Identity is a garnish on the mint — failure keeps the house look.
      });
  }
}

export interface UseShelfKitchensOptions {
  householdId?: string;
  /** Preview surfaces pass sample recipes; no network is touched. */
  previewRecipes?: SavedRecipe[];
  /** Preview surfaces may pass sample identities to demo generated kitchens. */
  previewIdentities?: Record<string, GeneratedIdentity>;
  /** Bump to refetch outside a focus change (e.g. after an inline ingest). */
  refreshKey?: number;
}

export function useShelfKitchens({
  householdId,
  previewRecipes,
  previewIdentities,
  refreshKey = 0,
}: UseShelfKitchensOptions): Genesis {
  const [fetched, setFetched] = useState<SavedRecipe[] | null>(null);
  const [identities, setIdentities] = useState<Record<string, GeneratedIdentity>>(NO_IDENTITIES);

  const mergeIdentity = useCallback((identity: GeneratedIdentity) => {
    setIdentities((prev) => ({ ...prev, [identity.cuisine]: identity }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (previewRecipes || !householdId) return;
      let cancelled = false;
      Promise.all([
        api.listRecipes({ household_id: householdId }),
        api.kitchenIdentities({ household_id: householdId }).catch(() => ({ identities: [] })),
      ])
        .then(([shelf, ids]) => {
          if (cancelled) return;
          const known = identityMap(ids.identities);
          setFetched(shelf.recipes);
          setIdentities(known);
          kickArtGeneration(shelf.recipes);
          const opened = deriveGenesis(shelf.recipes, known).kitchens;
          kickIdentityGeneration(householdId, opened, known, mergeIdentity);
        })
        .catch(() => {
          // The shelf being unreachable never breaks the home — no kitchens.
        });
      return () => {
        cancelled = true;
      };
    }, [householdId, previewRecipes, mergeIdentity, refreshKey]),
  );

  return useMemo(() => {
    const recipes = previewRecipes ?? fetched;
    if (!recipes) return EMPTY;
    const ids = previewRecipes ? previewIdentities ?? NO_IDENTITIES : identities;
    return deriveGenesis(recipes, ids);
  }, [previewRecipes, previewIdentities, fetched, identities]);
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
      Promise.all([
        api.listRecipes({ household_id: householdId }),
        api.kitchenIdentities({ household_id: householdId }).catch(() => ({ identities: [] })),
      ])
        .then(([shelf, ids]) => {
          if (cancelled) return;
          const known = identityMap(ids.identities);
          kickArtGeneration(shelf.recipes);

          // Dress this kitchen from the shelf + whatever identities we have.
          const dress = (all: Record<string, GeneratedIdentity>) => {
            const kitchen = deriveGenesis(shelf.recipes, all).kitchens.find(
              (entry) => entry.cuisine === cuisine,
            );
            setState({
              costume: kitchen
                ? costumeForShelfKitchen(kitchen.cuisine, kitchen.restaurant, kitchen.identity)
                : null,
              loading: false,
            });
          };

          dress(known);
          kickIdentityGeneration(householdId, deriveGenesis(shelf.recipes, known).kitchens, known, (identity) => {
            if (!cancelled && identity.cuisine === cuisine) dress({ ...known, [cuisine]: identity });
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
